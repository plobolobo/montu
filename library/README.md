# QuickRoute Address Parser

A robust NestJS library for parsing Australian addresses using the TomTom Search API with comprehensive error handling and enterprise-grade reliability.

## Features

- 🇦🇺 **Australia-only**: Strict validation for Australian addresses with country filtering
- 🔌 **TomTom Integration**: Primary provider using TomTom Search API v2
- 🏗️ **Extensible Architecture**: Provider factory pattern for multiple API providers (Google Maps ready)
- 🛡️ **Type Safety**: Full TypeScript support with Zod schema validation
- ⚡ **Performance**: Built-in retry logic with exponential backoff
- 🔄 **Resilient**: Global exception filters and HTTP error interceptors
- 📊 **Comprehensive Logging**: Structured logging with correlation IDs
- 🧪 **Well Tested**: 291 tests with Vitest and comprehensive coverage
- 🔒 **Production Ready**: Enhanced error handling with security considerations

## Installation

```bash
npm install quickroute-address-parser
```

## Quick Start

### 1. Environment Configuration

Create a `.env` file with your TomTom API key:

```env
# TomTom Search API Configuration
TOMTOM_API_KEY=your_tomtom_api_key_here
TOMTOM_BASE_URL=https://api.tomtom.com
TOMTOM_VERSION=2
TOMTOM_COUNTRY_SET=AU
TOMTOM_LIMIT=10

# Retry Configuration for Outgoing Requests
RETRY_ATTEMPTS=3
RETRY_DELAY_BASE=1000
REQUEST_TIMEOUT=30000
```

### 2. Module Registration

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { QuickrouteAddressParserModule } from "quickroute-address-parser";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    QuickrouteAddressParserModule.register({
      isGlobal: true, // Optional: make globally available
      // Optional configuration overrides
      loggingConfig: {
        enableStackTrace: true,
        logLevel: "debug",
        maxStackDepth: 10,
      },
    }),
  ],
})
export class AppModule {}
```

### 3. Service Usage

```typescript
// address.controller.ts
import { Controller, Get, Query } from "@nestjs/common";
import { QuickrouteAddressParserService } from "quickroute-address-parser";

@Controller("addresses")
export class AddressController {
  constructor(private readonly addressParser: QuickrouteAddressParserService) {}

  @Get("search")
  async searchAddresses(@Query("q") query: string, @Query("limit") limit = 10) {
    try {
      const result = await this.addressParser.searchAddresses(query, limit);
      return {
        success: true,
        results: result.results,
        metadata: result.metadata,
        provider: this.addressParser.getProviderName(),
      };
    } catch (error) {
      // Errors are automatically handled by the library's global exception filter
      // with proper HTTP status codes and structured error responses
      throw error;
    }
  }
}
```

## API Reference

### Types

```typescript
interface ISuggestion {
  id: string;
  text: string;
  score: number;
  address: IAddress;
}

interface IAddress {
  fullAddress: string;
  streetNumber?: string;
  streetName?: string;
  suburb?: string;
  municipality?: string;
  state: string; // Australian state code (NSW, VIC, etc.)
  postcode: string; // 4-digit Australian postcode
  country: string; // Always "Australia"
  coordinates: ICoordinates;
  raw?: any; // Original API response data
}

interface ICoordinates {
  lat: number;
  lon: number;
}
```

### Service Methods

#### `searchAddresses(query: string, limit?: number)`

Search for Australian address suggestions with detailed metadata.

**Parameters:**

- `query` (string): Partial address string (3-200 characters)
- `limit` (number, optional): Maximum suggestions to return (1-100, default: 10)

**Returns:** Promise resolving to:

```typescript
{
  results: ISuggestion[];     // Array of address suggestions
  metadata: {
    query: string;            // The validated search query
    limit: number;            // The limit that was applied
    resultCount: number;      // Actual number of results returned
    warnings: string[];       // Any validation warnings
  };
}
```

**Throws:**

- `InvalidInputException`: Invalid query length or parameters (400 Bad Request)
- `NoResultsException`: No addresses found for query (404 Not Found)
- `CountryMismatchException`: Non-Australian addresses returned (422 Unprocessable Entity)
- `ProviderException`: TomTom API errors (500+ depending on provider error type)
- `ConfigurationException`: Missing or invalid API configuration (500 Internal Server Error)

#### `getProviderName(): string`

Returns the name of the current address provider (`"TomTom"`).

## Configuration

### Environment Variables

| Variable             | Required | Default                  | Description              |
| -------------------- | -------- | ------------------------ | ------------------------ |
| `TOMTOM_API_KEY`     | ✅       | -                        | TomTom Search API key    |
| `TOMTOM_BASE_URL`    | ❌       | `https://api.tomtom.com` | TomTom API base URL      |
| `TOMTOM_VERSION`     | ❌       | `2`                      | TomTom API version       |
| `TOMTOM_COUNTRY_SET` | ❌       | `AU`                     | Country restriction      |
| `TOMTOM_LIMIT`       | ❌       | `10`                     | Default result limit     |
| `RETRY_ATTEMPTS`     | ❌       | `3`                      | Number of retry attempts |
| `RETRY_DELAY_BASE`   | ❌       | `1000`                   | Base retry delay (ms)    |
| `REQUEST_TIMEOUT`    | ❌       | `30000`                  | Request timeout (ms)     |

### Query Validation

| Requirement        | Value             | Description                 |
| ------------------ | ----------------- | --------------------------- |
| **Minimum Length** | 3 characters      | Below this returns error    |
| **Maximum Length** | 200 characters    | Above this returns error    |
| **Optimal Range**  | 10-100 characters | Best balance of specificity |

## Error Handling

The library provides comprehensive error handling with automatic HTTP status code mapping:

### Automatic Error Handling

The library includes a global exception filter that automatically converts exceptions to proper HTTP responses with correlation IDs for tracking:

```typescript
// All errors are automatically handled and include:
{
  "error": "Human readable error message",
  "statusCode": 400, // Appropriate HTTP status code
  "timestamp": "2025-01-08T10:12:16.000Z",
  "path": "/addresses/search",
  "correlationId": "uuid-1234-5678-9abc",
  "context": {
    // Additional context based on error type
    "provider": "TomTom",
    "query": "user input",
    "limit": 10
  }
}
```

### Manual Error Handling (Optional)

For custom error handling, you can catch specific exception types:

```typescript
import {
  InvalidInputException,
  NoResultsException,
  CountryMismatchException,
  ProviderException,
  ConfigurationException,
} from "quickroute-address-parser";

try {
  const results = await addressParser.searchAddresses("Collins St Melbourne");
} catch (error) {
  if (error instanceof InvalidInputException) {
    // Handle invalid input (query too short/long, invalid limit) - 400
  } else if (error instanceof NoResultsException) {
    // Handle no results found - 404
  } else if (error instanceof CountryMismatchException) {
    // Handle non-Australian results - 422
  } else if (error instanceof ProviderException) {
    // Handle TomTom API errors (authentication, rate limits, etc.) - 500+
  } else if (error instanceof ConfigurationException) {
    // Handle missing configuration - 500
  }
}
```

## Example Usage

### Basic Address Search

```typescript
const result = await addressParser.searchAddresses(
  "123 Collins Street Melbourne"
);

// Returns structured response with metadata:
{
  results: [
    {
      id: "BZh2IikG98CrrMCwZ0N8ug",
      text: "123 Collins Street, Mentone, VIC, 3194",
      score: 8.24,
      address: {
        fullAddress: "123 Collins Street, Mentone, VIC, 3194",
        streetNumber: "123",
        streetName: "Collins Street",
        suburb: "Mentone",
        municipality: "Melbourne",
        state: "VIC",
        postcode: "3194",
        country: "Australia",
        coordinates: {
          lat: -37.980283,
          lon: 145.067699,
        },
        raw: {
          /* Original TomTom response data */
        },
      },
    },
  ],
  metadata: {
    query: "123 Collins Street Melbourne",
    limit: 10,
    resultCount: 1,
    warnings: []
  }
}
```

### Limited Results

```typescript
const result = await addressParser.searchAddresses("George Street Sydney", 5);
// Returns maximum 5 suggestions with metadata
```

### Handling Validation Warnings

```typescript
const result = await addressParser.searchAddresses("xy"); // Too short
// Throws InvalidInputException automatically

const result = await addressParser.searchAddresses("valid query");
if (result.metadata.warnings.length > 0) {
  console.log("Validation warnings:", result.metadata.warnings);
}
```

## Development

### Prerequisites

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Add your TomTom API key to .env
```

### Building

```bash
npm run build
npm run clean  # Clean build artifacts
```

### Testing

```bash
npm run test           # Run all tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
```

### Development

```bash
npm run dev            # Build in watch mode
npm run lint           # Lint TypeScript files
```

### Architecture

The library uses a modern NestJS architecture with:

- **Provider Pattern**: Extensible provider system (TomTom, Google Maps ready)
- **Global Exception Filter**: Automatic error handling with correlation IDs
- **HTTP Error Interceptor**: Automatic HTTP error transformation
- **Zod Validation**: Runtime type safety and input validation
- **Structured Logging**: Comprehensive logging with context
- **Retry Logic**: Built-in retry with exponential backoff
