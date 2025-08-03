# Operations & Compliance

## Software Delivery Lifecycle (GitHub Actions CI/CD)

The system employs a robust and automated CI/CD pipeline using GitHub Actions, ensuring rapid, secure, and compliant software delivery:

- **Version Control:** All code, Infrastructure as Code (IaC) definitions, and CI/CD workflow definitions are stored in dedicated GitHub repositories.
- **Automated Workflow Triggers:** CI/CD workflows are automatically triggered by events such as code pushes to branches, Pull Request (PR) creations, and scheduled runs.

### Continuous Integration (CI)

- **Build & Test:** Code is compiled, unit tests and integration tests are executed, and static code analysis (linters, SAST tools like SonarQube).
- **Container Image Building & Scanning:** Docker images for microservices are scanned for vulnerabilities using tools like **Snyk** and pushed to the registry.
- **PII Logging Scan:** Automated scanning is integrated into the CI pipeline to detect and prevent accidental logging of Personally Identifiable Information (PII).

### Continuous Delivery (CD)

- **Infrastructure as Code (IaC):** AWS infrastructure (VPCs, EKS clusters, RDS instances, etc.) is provisioned and managed using **Terraform or AWS CloudFormation** from a dedicated IaC repository.
- **Database Migrations:** Automated schema migrations are handled using tools like **Prisma** (the chosen ORM) applied during deployments.
- **Deployment to EKS:** Microservices are deployed to the EKS cluster using `kubectl` commands and **Helm charts**, which define application deployments. **Blue/Green** (As opposed to **Canary** due to quick-rollback priority over sampling) deployment strategies are employed to minimize downtime and risk during releases.
- **Automated Testing:** After deployment to staging environments, a suite of automated tests is executed, including post-deployment integration tests, API contract tests, and end-to-end (E2E) tests that simulate realistic user workflows.

### DevSecOps & Release Gating

- **DAST Scans:** Dynamic Application Security Testing (DAST) scans are performed against deployed applications in staging to identify runtime vulnerabilities.
- **Manual Approval Gates:** For deployments to sensitive environments (e.g., UAT, Production), manual approval gates are configured, requiring sign-off from relevant stakeholders (e.g., security, operations, business).
- **Automated Rollback:** Defined rollback procedures and automation are in place to quickly revert to a previous stable version in case of critical issues post-deployment.
- **Deployment Environments:** The following distinct deployment environments are maintained: `dev`, `QA`, `staging`, `UAT`, `Production`.
- **Feature Flags:** Feature flags are integrated into the application to decouple code deployments from feature releases, enable A/B testing, and provide a quick mechanism to disable new features if issues arise.

## Compliance & Legal Considerations

The system design adheres to relevant Australian regulations and guidelines for healthcare data:

### Australian Privacy Principles (APPs)

The system is designed to fully comply with all 13 Australian Privacy Principles, with particular emphasis on:

- **APP 11 (Security of Personal Information):** Robust security measures (encryption, access control, audit logs) are in place to protect personal information from misuse, interference, loss, unauthorized access, modification, or disclosure.
- **APP 12 (Access to Personal Information):** Patients have the right to access their personal information held by the clinic. The User Service facilitates this access securely.
- **APP 13 (Correction of Personal Information):** Patients can request correction of their personal information. The User Service provides mechanisms for users to update their profiles.
- **Pseudonymity:** The strong pseudonymity implemented via `clientID` and the `users_pii_vault` directly allows for anonymous interaction where appropriate and de-identification.

### Data Retention & Management

- **Data Retention for Adults:** Health records for adults must be retained for at least 7 years from the date of last service. The data tiering and archival strategy (S3 Standard-IA, Glacier, Deep Archive) is specifically designed to meet this requirement.
- **Register of Deleted Records:** A mandatory immutable `Register of Deleted Records` is maintained to log all requests for data deletion and the details of the data purged, ensuring compliance and auditability.

### Emergency Access & Security

- **Emergency Access Protocol ("Break Glass"):** A highly controlled "Global Admin" role exists for emergency access to the system in critical situations. This role requires multi-factor authentication (MFA), preferably hardware MFA, and any activation of this role triggers immediate, high-priority alerts (e.g., via AWS SNS to security and compliance personnel) to ensure full auditability and accountability.

### Future Integration Requirements

- **Healthcare Identifiers (HI) Service (Future):** The architecture acknowledges the future need for integration with the Healthcare Identifiers (HI) Service for accurate identification of individuals and healthcare providers.
- **My Health Record (MHR) Integration (Future):** The system design is prepared for future integration with the My Health Record system, allowing for secure exchange of patient health information.

## Additional Architectural Considerations

### Fault Tolerance & Disaster Recovery

- **Circuit Breakers & Bulkheads:** Microservices implement circuit breaker patterns to prevent cascading failures and bulkhead patterns to isolate failures within services, improving overall system resilience.
- **Health Checks:** Regular health checks are performed by EKS and load balancers to identify unhealthy instances and route traffic away from them.
- **Auto-scaling:** AWS EKS and RDS instances are configured with auto-scaling groups to automatically adjust capacity based on demand, ensuring performance and availability during traffic spikes.
- **Multi-AZ RDS Deployments:** RDS databases are deployed in a Multi-Availability Zone (Multi-AZ) configuration for high availability and automatic failover in case of an AZ outage.
- **SSE Client Handling:** For SSE connections, client-side applications are designed with robust retry logic to re-establish connections gracefully in case of service restarts, scaling events, or network interruptions. They will also inform the user if the schedule may be stale and visually indicate a data re-sync.

### Security & Access Control

- **IAM Roles:** Adherence to the **need-to-know** and **least privilege** principles for all IAM roles assigned to services and users
- **Cloud Access:** All administrative access to the AWS cloud environment requires **Multi-Factor Authentication (MFA)**.
- **Separation of Duties:** Roles are designed to enforce separation of duties, for example, individuals responsible for generating data cannot modify audit logs, ensuring integrity of the audit trail.

### Operational Excellence

- **Audit Trail:** Beyond CloudWatch, a detailed application-level logging to an immutable `Audit Logs DB` captures all significant business events and system interactions. Each log entry includes a **`CorrelationId`** for tracing requests across multiple microservices. Crucially, automatic doctor re-assignments are fully audited, including the original doctor, the new doctor, and the timestamp of the change.
- **Data Volume Estimation:** The system's scalability is designed with potential data volumes in mind, especially for appointments, audit logs, and user data over a 7+ year retention period. **Sharding on `clientID`** is acknowledged as a future scalability option for high-volume tables like appointments and audit logs, should performance requirements necessitate it.
- **UTC Times:** All internal system times are stored and processed in Coordinated Universal Time (UTC). Conversion to local timezones is handled at the client-side application layer.
- **SSE Stream Security & Authentication:** When a client initiates an SSE connection, it is authenticated (e.g., by validating a JWT obtained after initial login via Amazon Cognito). This authentication allows the Appointment Service to determine the client's role (patient/staff) and tailor the SSE stream content and authorization accordingly. Broad anonymous availability updates are provided for patients, while detailed, `patientId`based information is streamed to authorized staff, ensuring data privacy and appropriate access.

---

_Related sections: [System Design & Architecture](README.md) | [Infrastructure & Implementation](infrastructure.md)_
