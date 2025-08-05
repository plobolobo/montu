# Quickroute Address Parser

A powerful NestJS library for parsing Australian addresses that works both as a **NestJS module** and as a **standalone module**.

## Features

- ✅ **Dual Usage**: Full NestJS module OR standalone bundle
- ✅ **Australian Focused**: Optimized for Australian addresses
- ✅ **Provider Support**: TomTom integration
- ✅ **Built-in Validation**: Automatic input validation with warnings
- ✅ **Full TypeScript Support**: Complete type safety

## Design Decision Note:

In a production environment, I would typically recommend implementing either a framework-agnostic solution or a dedicated NestJS module, rather than supporting both approaches. This dual implementation introduces additional build complexity that may not be justified in most use cases.

The choice would ultimately depend on the target audience and integration requirements. While I generally favor simpler, framework-agnostic solutions for broader compatibility, I've implemented both approaches here to showcase comprehensive NestJS expertise and provide maximum flexibility for different integration scenarios.

## Installation

```bash
npm install @plobolobo/quickroute-address-parser
```

## Usage

### Standalone Usage

Perfect for scripts, microservices, or any Node.js application:

```typescript
import QuickrouteAddressParser from "@plobolobo/quickroute-address-parser/standalone";

const parser = new QuickrouteAddressParser({
  tomtomApiKey: process.env.TOMTOM_API_KEY,
  enableLogging: true,
  timeout: 5000,
});

async function searchAddresses() {
  try {
    const { results, metadata } = await parser.searchAddresses(
      "Collins Street Melbourne",
      5
    );

    console.log(`Found ${metadata.resultCount} results:`);

    results.forEach(({ text, score, address }) => {
      console.log(`- ${text} (Score: ${score})`);
      console.log(`  Suburb: ${address.suburb}, Postcode: ${address.postcode}`);

      if (address.coordinates) {
        const { lat, lon } = address.coordinates;
        console.log(`  📍 ${lat}, ${lon}`);
      }
    });

    if (metadata.warnings.length > 0) {
      console.warn("⚠️ Warnings:", metadata.warnings);
    }
  } catch (error) {
    console.error("❌ Search failed:", error.message);
  } finally {
    await parser.close();
  }
}

searchAddresses();
```

### NestJS Integration

For full NestJS applications with dependency injection:

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { QuickrouteAddressParserModule } from "@plobolobo/quickroute-address-parser";

@Module({
  imports: [
    ConfigModule.forRoot(),
    QuickrouteAddressParserModule.register({
      isGlobal: true,
      tomtomApiKey: process.env.TOMTOM_API_KEY,
      baseUrl: process.env.TOMTOM_BASE_URL,
      timeout: parseInt(process.env.REQUEST_TIMEOUT || "30000"),
      retries: parseInt(process.env.RETRY_ATTEMPTS || "3"),
    }),
  ],
  controllers: [AddressController],
})
export class AppModule {}

// address.controller.ts
import { Controller, Get, Query } from "@nestjs/common";
import { QuickrouteAddressParserService } from "@plobolobo/quickroute-address-parser";

@Controller("api/addresses")
export class AddressController {
  constructor(private readonly addressParser: QuickrouteAddressParserService) {}

  @Get("search")
  async search(@Query("q") query: string, @Query("limit") limit = 10) {
    try {
      const { results, metadata } = await this.addressParser.searchAddresses(
        query,
        limit
      );

      return {
        success: true,
        data: results.map(({ text, score, address }) => ({
          text,
          score,
          suburb: address.suburb,
          postcode: address.postcode,
          coordinates: address.coordinates,
        })),
        metadata,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get("provider")
  async getProvider() {
    const providerName = await this.addressParser.getProviderName();
    return { provider: providerName };
  }
}
```

## API Reference

### Search Result

```typescript
interface SearchResult {
  results: Array<{
    text: string;
    score: number;
    address: {
      fullAddress: string;
      streetNumber: string;
      streetName: string;
      suburb: string;
      municipality: string;
      state: string;
      postcode: string;
      country: string;
      coordinates?: { lat: number; lon: number };
    };
  }>;
  metadata: {
    query: string;
    limit: number;
    resultCount: number;
    warnings: string[];
  };
}
```

### Standalone Configuration

```typescript
interface StandaloneConfig {
  tomtomApiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  enableLogging?: boolean;
}
```

## Examples

**[standalone-basic.ts](./examples/standalone-basic.ts)** - Simple standalone usage

# Development

### Prerequisites

- Node.js ≥22.0.0
- npm ≥9.0.0

### Setup

```bash
npm install
```

### Commands

```bash
# Build the library
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Clean build artifacts
npm run clean
```
