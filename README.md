# Montu Design Assignment

This repository contains the solution for the Montu take-home assignment, consisting of two main components:

## 📚 Part 1: QuickRoute Address Parser Library

**[→ View Library Documentation](./library/README.md)**

A robust NestJS library for parsing Australian addresses using the TomTom Search API with comprehensive error handling and enterprise-grade reliability. Features a config-only approach with no environment variable dependencies.

**Key Features:**

- 🇦🇺 Australia-only address validation with country filtering
- 🔌 TomTom Search API v2 integration
- ⚙️ **Config-only approach** - no environment variables required
- 🛡️ Full TypeScript support with Zod schema validation
- 🔄 Global exception filters and HTTP error interceptors
- 📦 **Standalone & module usage** - flexible integration options
- 🧪 **126 comprehensive tests** including integration testing
- 📘 **npm published** - ready for production use

**Quick Start:**

```bash
cd library/
npm install
npm test
npm run build  # Build for distribution
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
│   ├── __tests__/             # Comprehensive test suite (126 tests)
│   │   ├── integration/       # Integration tests for distribution
│   │   ├── dto/              # Data transfer object tests
│   │   ├── services/         # Service layer tests
│   │   └── providers/        # Provider tests
│   ├── dist/                  # Built distribution files
│   ├── examples/              # Usage examples
│   ├── package.json           # Library dependencies and scripts
│   └── README.md              # Library documentation
├── system-design/             # Appointment System Design
│   ├── img/                   # Architecture diagrams
│   ├── infrastructure.md      # Infrastructure documentation
│   ├── operations.md          # Operations and compliance
│   └── README.md              # System design overview
└── README.md                  # This overview file
```
