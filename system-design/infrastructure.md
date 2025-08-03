# Infrastructure & Implementation

## Key Architectural Components (AWS-centric)

This section details the primary AWS services utilized and their roles within the system:

### Compute

- **AWS EKS (Elastic Kubernetes Service):** Serves as the container orchestration platform for deploying and managing the microservices.

### Asynchronous Messaging

- **Amazon MSK (Managed Streaming for Apache Kafka):** MSK acts as the central asynchronous message bus for inter-service communication

### Databases

- **AWS RDS for PostgreSQL:** Used as the relational database service for storing various datasets, including:
  - `users_pii_vault`: Securely stores sensitive patient and staff PII.
  - `users_profile`: Stores non-PII user profile information.
  - `appointments`: Manages all appointment-related data.
  - `doctors`: Stores doctor profiles, availability, and schedules.
  - `staff`: Manages clinic staff details.
  - `audit_logs`: An immutable database for comprehensive audit trails.
- **Data Encryption using AWS KMS (Key Management Service):** All data at rest in RDS is encrypted using AWS KMS-managed keys.
- **Data Tiering & Archival:** To meet the 7-year data retention requirement for adults, a "hot, warm, cold" storage strategy is implemented:
  - **Hot Storage:** Active data resides in AWS RDS for immediate access.
  - **Warm Storage:** Less frequently accessed but still required data is moved to Amazon S3 Standard-Infrequent Access using **AWS Glue** and **Lambda** functions (running as a fault-tolerant cron job twice daily) for automated data cleanup and transfer.
  - **Cold Storage (Glacier, Deep Archive):** Historical data that needs to be retained for compliance but is rarely accessed is moved to Amazon S3 Glacier and S3 Glacier Deep Archive, providing cost-effective long-term storage.
- **Register of Deleted Records:** For compliance reasons: A separate, immutable record is maintained for all data that has been explicitly "deleted" from the active system, detailing the `clientID`, type of data, and timestamp of deletion.

### Identity & Access Management

- **AWS IAM (Identity and Access Management):** Used for managing permissions for AWS resources, ensuring that microservices and other AWS components adhere to the principle of least privilege.
- **AWS KMS (Key Management Service):** Manages encryption keys used throughout the system for data at rest.
- **AWS Secrets Manager:** Securely stores and manages sensitive credentials, API keys, and other secrets required by applications, preventing hardcoding of sensitive information.
- **Amazon Cognito:** Provides user directory, authentication, and authorization services for both patients and staff, simplifying user management and ensuring secure access to client applications.

### Networking & Security

- **API Gateway:** Acts as the single entry point for all external API requests, providing features like request routing, authentication, authorization, and throttling.
  - Creates the `CorrelationId` if one hasn't been provided by the client
- **ALB (Application Load Balancer):** Distributes incoming application traffic across multiple targets, such as EKS pods. The ALB also manages long-lived HTTP connections required for Server-Sent Events (SSE) from the Appointment Service to clients.
- **AWS WAF (Web Application Firewall):** Protects web applications or APIs from common web exploits that may affect availability, compromise security, or consume excessive resources.
- **AWS Shield:** Provides managed DDoS protection for applications running on AWS.
- **VPC (Virtual Private Cloud):** The entire system is deployed within a VPC, segmented into private and public subnets.
  - **Private Subnets:** Host sensitive resources like EKS worker nodes, RDS instances, and MSK brokers.
  - **Public Subnets:** Host public-facing components like Application Load Balancers and API Gateway endpoints.
- **SSL/TLS with AWS ACM (Certificate Manager):** All communication in transit is encrypted using SSL/TLS certificates

### Observability

- **CloudWatch Logs:** Centralized logging for all application and infrastructure logs, enabling monitoring, analysis, and alerting.
- **CloudWatch Metrics:** Collects and tracks performance metrics from AWS services and custom application metrics, including Kafka-specific metrics from Amazon MSK and metrics for SSE connections and message throughput.
- **CloudWatch Alarms:** Configured to trigger notifications based on predefined metric thresholds, enabling proactive issue detection and resolution.
  - Could always use a 3rd-party, e.g (datadog, new relic)
  - Connect alarms / incident reporting to slack/teams, emails, etc… Tiered Response, and incident playbooks
- **AWS X-Ray / Datadog:** Provides end-to-end tracing of requests as they flow through the microservices architecture, helping to identify performance bottlenecks and debugging issues in distributed systems.

## Microservices Deep Dive

This section provides a higher-level overview of each core microservice, detailing its primary responsibilities and how it addresses key architectural challenges:

- **Privacy Policy System:**
  - Content for the privacy policy is managed in Amazon S3 and distributed via CloudFront for global low-latency access. Version control for the policy content is maintained in a GitHub repository.
- **User Service:**
  - **Responsibilities:** Manages patient and staff PII (`users_pii_vault`) and non-PII profiles (`users_profile`). Handles user registration, login (via Amazon Cognito), and profile updates.
  - **Consent Management:** Tracks granular user consent in a dedicated `consent_table`, ensuring adherence to privacy regulations and providing an auditable record of consent.
- **Appointment Service:**
  - **Responsibilities:** Manages the entire lifecycle of appointments, including booking, modifications, and cancellations.
  - **Idempotency Keys:** Utilizes idempotency keys for all booking and modification requests to prevent double-booking or unintended side effects during retries in a distributed environment.
  - **Doctor Availability Caching & RDI (Read Data Isolation):** Caches doctor availability to improve performance. Employs Redis Data Integration (RDI) ensuring data consistency
  - **Server-Sent Events (SSE) Implementation:** Leverages NestJS's SSE capabilities to provide near real-time updates to connected clients.
  - **Doctor Re-assignment Logic:** In the event a doctor becomes unexpectedly unavailable (e.g., due to an emergency), the Appointment Service is responsible for automatically re-assigning affected patients to a new available doctor. This re-assignment prioritizes finding a suitable replacement without canceling the appointment for the patient. This re-assignment is fully audited in the `audit_logs` database.
- **Notification Service:**
  - **Responsibilities:** Handles sending automated appointment confirmations, reminders, and crucial updates (e.g., doctor re-assignment notifications) to patients and staff.
  - **Idempotency Keys:** Employs idempotency keys to prevent duplicate notifications from being sent on retry attempts, ensuring a consistent user experience.
  - **Third-Party Integration:** For actual message delivery (SMS/email), the service will leverage a third-party messaging service (e.g., Twilio), assuming it provides its own idempotency mechanisms.
  - **Crucial Role in Re-assignment:** This service is specifically leveraged to send SMS or email notifications to patients whenever their appointment has been automatically re-assigned to a new doctor due to unforeseen unavailability of the originally assigned doctor.
- **Doctor Management Service:**
  - **Responsibilities:** Manages doctor profiles, availability schedules, and statuses.
  - **Kafka Events:** Publishes events to Kafka when doctor status or availability changes. These events are consumed by the Appointment Service's SSE component to trigger real-time updates to clients.
- **Admin/Staff Management Service:**
  - **Responsibilities:** Manages clinic staff roles, permissions, and access levels within the system, adhering to the RBAC model.
- **MHR Integration Service (Future):**
  - **Purpose:** Placeholder for future integration with the My Health Record system, enabling secure exchange of health information.
- **HI Service Integration (Future):**
  - **Purpose:** Placeholder for future integration with the Healthcare Identifiers (HI) Service for robust patient and healthcare provider identification.

## Transactional "Gotchas" & Solutions

Distributed systems introduce complexities not found in monolithic applications. Here's how key transactional challenges are addressed:

### 1. Dual Writes (Database Update + Kafka Message)

- **Problem:** Ensuring atomicity when an operation requires both a database update and publishing a Kafka message. A failure after the database commit but before the Kafka message is sent can lead to data inconsistency.
- **Solution: Transactional Outbox Pattern:**
  - The database update and the Kafka message are written within a single, local database transaction. The Kafka message is initially written to an "outbox" table within the same database as the business data.
  - An **Outbox Relayer** (e.g Debezium) monitors the outbox table for new messages.
  - When a new message is detected, the Relayer reads it, publishes it to Kafka using a **Kafka idempotent producer** (ensuring at-least-once delivery without duplicates), and then marks the message as processed in the outbox table.
  - This guarantees that either both operations succeed or neither does, maintaining data consistency.

### 2. Consumer Idempotency

- **Problem:** Kafka's "at-least-once" delivery guarantee means consumers might receive the same message multiple times (e.g., due to network issues, consumer restarts). Processing a message more than once can lead to incorrect state or duplicate side effects.
- **Solution: Idempotent Consumers:**
  - Consumers track processed unique message IDs, typically stored in a dedicated table. Before processing a message, the consumer checks if its ID has already been recorded.
  - Alternatively, **business key checks** are performed. For example, when processing an "appointment booked" event, the consumer checks if an appointment with that specific `appointmentID` already exists. If it does, the duplicate message is safely ignored.

### 3. Message Ordering

- **Problem:** Kafka guarantees message order only within a single partition. If messages for the same entity (e.g., `clientID`, `appointmentID`) are spread across multiple partitions, their processing order is not guaranteed, potentially leading to incorrect state transitions.
- **Solution: Keying by Entity ID & Single Consumer per Partition:**
  - **Keying by Entity ID:** Kafka messages related to a specific entity (e.g., all events for a particular `clientID` or `appointmentID`) are produced with that entity's ID as the Kafka message key. This ensures that all messages for that entity are routed to the same Kafka partition.
  - **Single Consumer per Partition:** Within a consumer group, only one consumer instance is assigned to process messages from a given partition. This guarantees strict ordering of messages for that entity.
  - **Explicit Offset Commits:** Consumers explicitly commit their processed offsets, ensuring that upon restart, they resume processing from the last successfully processed message.

### 4. Real-time Update Consistency with SSE

- **Problem:** While SSE provides near real-time updates, there's inherent latency between a database commit, Kafka event propagation, and the SSE message reaching the client. This can lead to transient inconsistencies where the client's view is slightly behind the actual committed state.
- **Solution:** The system ensures that SSE reflects the _committed_ state of the schedule. This emphasizes **eventual consistency** for real-time views. Client-side applications are designed to handle these transient inconsistencies by:
  - Providing visual cues to the user if data is potentially stale or a re-sync is in progress.
  - Implementing client-side retry logic for SSE connection drops.
  - Potentially implementing client-side reconciliation mechanisms or periodic full data refreshes to ensure eventual consistency. The user experience prioritizes providing the most up-to-date information possible while acknowledging potential micro-delays.

---

_Related sections: [System Design & Architecture](README.md) | [Operations & Compliance](operations.md)_
