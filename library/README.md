# QuickRoute Address Parser

A robust NestJS library for parsing Australian addresses using the TomTom Search API.

## Features

- 🇦🇺 **Australia-only**: Strict validation for Australian addresses
- 🔌 **TomTom Integration**: Primary provider using TomTom Search API
- 🏗️ **Extensible Architecture**: Adapter pattern for future API providers
- 🛡️ **Type Safety**: Full TypeScript support with comprehensive interfaces
- ⚡ **Performance**: Built-in caching and request deduplication
- 🔄 **Resilient**: Retry logic with exponential backoff
- 🧪 **Well Tested**: Comprehensive test coverage with Vitest

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
import { QuickrouteAddressParserModule } from "quickroute-address-parser";

@Module({
  imports: [
    QuickrouteAddressParserModule.register({
      isGlobal: true, // Optional: make globally available
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
    const result = await this.addressParser.searchAddresses(query, limit);
    return {
      success: true,
      results: result.results,
      metadata: result.metadata,
      provider: this.addressParser.getProviderName(),
    };
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

- `InvalidInputException`: Invalid query length or parameters
- `NoResultsException`: No addresses found for query
- `CountryMismatchException`: Non-Australian addresses returned
- `TomTomAPIException`: TomTom API errors

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

The library provides detailed error types for different scenarios:

```typescript
try {
  const results = await addressParser.parseAddress("Collins St Melbourne");
} catch (error) {
  if (error instanceof InvalidInputException) {
    // Handle invalid input (query too short/long, invalid limit)
  } else if (error instanceof NoResultsException) {
    // Handle no results found
  } else if (error instanceof CountryMismatchException) {
    // Handle non-Australian results
  } else if (error instanceof TomTomAPIException) {
    // Handle TomTom API errors (authentication, rate limits, etc.)
  }
}
```

## Example Usage

### Basic Address Search

```typescript
const suggestions = await addressParser.parseAddress(
  "123 Collins Street Melbourne"
);

// Returns:
[
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
        /* Original TomTom response */
      },
    },
  },
];
```

### Limited Results

```typescript
const suggestions = await addressParser.parseAddress("George Street Sydney", 5);
// Returns maximum 5 suggestions
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm run test
npm run test:watch
npm run test:coverage
```

### Linting

```bash
npm run lint
```

## License

MIT License. See LICENSE file for details.

## Contributing

Please read our contributing guidelines before submitting pull requests.

## Support

For issues and questions, please use the GitHub issue tracker.
