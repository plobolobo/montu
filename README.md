# Montu Design Assignment

This repository contains the solution for the Montu take-home assignment, consisting of two main components:

## 📚 Part 1: QuickRoute Address Parser Library

**[→ View Library Documentation](./library/README.md)**

A robust NestJS library for parsing Australian addresses using the TomTom Search API with comprehensive error handling and enterprise-grade reliability.

**Key Features:**

- 🇦🇺 Australia-only address validation with country filtering
- 🔌 TomTom Search API v2 integration
- 🛡️ Full TypeScript support with Zod schema validation
- 🔄 Global exception filters and HTTP error interceptors
- 🧪 291 tests with comprehensive coverage

**Quick Start:**

```bash
cd library/
npm install
npm test
```

## 🏗️ Part 2: Appointment Scheduling System Design

**[→ View System Design Documentation](./system-design/README.md)**

A comprehensive system design for a healthcare appointment scheduling platform using microservices architecture with event-driven communication.

**Key Features:**

- 🔐 Privacy-by-design with strong pseudonymity
- ⚡ Real-time updates via Server-Sent Events (SSE)
- 🌐 AWS-based microservices architecture
- 📊 Comprehensive audit logging and RBAC
- 🔄 Automatic doctor re-assignment capabilities

**Architecture Overview:**

- **[Infrastructure & Implementation](./system-design/infrastructure.md)**
- **[Operations & Compliance](./system-design/operations.md)**

## 📁 Project Structure

```
├── library/                    # QuickRoute Address Parser Library
│   ├── src/                   # TypeScript source code
│   ├── __tests__/             # Comprehensive test suite (291 tests)
│   ├── package.json           # Library dependencies and scripts
│   └── README.md              # Library documentation
├── system-design/             # Appointment System Design
│   ├── img/                   # Architecture diagrams
│   ├── infrastructure.md      # Infrastructure documentation
│   ├── operations.md          # Operations and compliance
│   └── README.md              # System design overview
└── README.md                  # This overview file
```
