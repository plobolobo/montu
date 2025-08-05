import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NestFactory } from "@nestjs/core";
import { INestApplicationContext } from "@nestjs/common";
import { QuickrouteAddressParser } from "../src/standalone";
import { QuickrouteAddressParserService } from "../src/services/quickroute-address-parser.service";
import { QuickrouteAddressParserModule } from "../src/quickroute-address-parser.module";
import { StandaloneConfig } from "../src/types/standalone.types";
import { SearchResult } from "../src/types";

// Mock NestFactory
vi.mock("@nestjs/core", () => ({
  NestFactory: {
    createApplicationContext: vi.fn(),
  },
}));

// Mock the module
vi.mock("../src/quickroute-address-parser.module", () => ({
  QuickrouteAddressParserModule: {
    register: vi.fn(),
  },
}));

describe("QuickrouteAddressParser (Standalone)", () => {
  let parser: QuickrouteAddressParser;
  let mockApp: Partial<INestApplicationContext>;
  let mockService: Partial<QuickrouteAddressParserService>;
  let config: StandaloneConfig;

  const mockSearchResult: SearchResult = {
    results: [
      {
        id: "test-id",
        address: "123 Test Street, Sydney NSW 2000, Australia",
        position: { lat: -33.8688, lon: 151.2093 },
        score: 0.95,
      },
    ],
    metadata: {
      query: "123 Test Street",
      limit: 10,
      resultCount: 1,
      warnings: [],
    },
  };

  beforeEach(() => {
    config = {
      apiKey: "test-api-key",
      baseUrl: "https://api.tomtom.com",
      timeout: 5000,
      retries: 3,
      enableLogging: false,
      loggingConfig: {
        enableRequestLogging: false,
      },
    };

    mockService = {
      searchAddresses: vi.fn(),
    };

    mockApp = {
      get: vi.fn().mockReturnValue(mockService),
      close: vi.fn(),
    };

    vi.mocked(NestFactory.createApplicationContext).mockResolvedValue(
      mockApp as INestApplicationContext
    );

    vi.mocked(QuickrouteAddressParserModule.register).mockReturnValue({
      module: QuickrouteAddressParserModule,
    } as any);

    parser = new QuickrouteAddressParser(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create instance with provided config", () => {
      expect(parser).toBeDefined();
      expect(parser).toBeInstanceOf(QuickrouteAddressParser);
    });

    it("should accept minimal config", () => {
      const minimalConfig: StandaloneConfig = {
        apiKey: "minimal-key",
      };
      const minimalParser = new QuickrouteAddressParser(minimalConfig);
      expect(minimalParser).toBeDefined();
    });
  });

  describe("initialization", () => {
    it("should initialize NestJS application context correctly", async () => {
      mockService.searchAddresses = vi.fn().mockResolvedValue(mockSearchResult);

      await parser.searchAddresses("test query");

      expect(NestFactory.createApplicationContext).toHaveBeenCalledWith(
        expect.any(Object), // Module result
        {
          logger: false, // Since enableLogging is false
        }
      );
    });

    it("should register module with correct configuration", async () => {
      mockService.searchAddresses = vi.fn().mockResolvedValue(mockSearchResult);

      await parser.searchAddresses("test query");

      expect(QuickrouteAddressParserModule.register).toHaveBeenCalledWith({
        isGlobal: true,
        apiKey: "test-api-key",
        baseUrl: "https://api.tomtom.com",
        timeout: 5000,
        retries: 3,
        loggingConfig: {
          enableRequestLogging: false,
        },
      });
    });

    it("should enable logging when configured", async () => {
      const configWithLogging: StandaloneConfig = {
        ...config,
        enableLogging: true,
      };
      const loggedParser = new QuickrouteAddressParser(configWithLogging);
      mockService.searchAddresses = vi.fn().mockResolvedValue(mockSearchResult);

      await loggedParser.searchAddresses("test query");

      expect(NestFactory.createApplicationContext).toHaveBeenCalledWith(
        expect.any(Object),
        {
          logger: ["log", "error", "warn", "debug"],
        }
      );
    });

    it("should only initialize once", async () => {
      mockService.searchAddresses = vi.fn().mockResolvedValue(mockSearchResult);

      // Call searchAddresses multiple times
      await parser.searchAddresses("query 1");
      await parser.searchAddresses("query 2");
      await parser.searchAddresses("query 3");

      // Should only create application context once
      expect(NestFactory.createApplicationContext).toHaveBeenCalledTimes(1);
    });

    it("should get service from application context", async () => {
      mockService.searchAddresses = vi.fn().mockResolvedValue(mockSearchResult);

      await parser.searchAddresses("test query");

      expect(mockApp.get).toHaveBeenCalledWith(QuickrouteAddressParserService);
    });
  });

  describe("searchAddresses", () => {
    it("should search addresses successfully", async () => {
      mockService.searchAddresses = vi.fn().mockResolvedValue(mockSearchResult);

      const result = await parser.searchAddresses("123 Test Street", 5);

      expect(mockService.searchAddresses).toHaveBeenCalledWith(
        "123 Test Street",
        5
      );
      expect(result).toEqual(mockSearchResult);
    });

    it("should use default limit when not provided", async () => {
      mockService.searchAddresses = vi.fn().mockResolvedValue(mockSearchResult);

      await parser.searchAddresses("123 Test Street");

      expect(mockService.searchAddresses).toHaveBeenCalledWith(
        "123 Test Street",
        10
      );
    });

    it("should handle empty results", async () => {
      const emptyResult: SearchResult = {
        results: [],
        metadata: {
          query: "Nonexistent",
          limit: 10,
          resultCount: 0,
          warnings: [],
        },
      };
      mockService.searchAddresses = vi.fn().mockResolvedValue(emptyResult);

      const result = await parser.searchAddresses("Nonexistent Address");

      expect(result).toEqual(emptyResult);
    });

    it("should throw error if service is not initialized", async () => {
      // Mock app.get to return null/undefined
      mockApp.get = vi.fn().mockReturnValue(null);

      await expect(parser.searchAddresses("test query")).rejects.toThrow(
        "Failed to initialize address parser service"
      );
    });

    it("should propagate service errors", async () => {
      const serviceError = new Error("Service unavailable");
      mockService.searchAddresses = vi.fn().mockRejectedValue(serviceError);

      await expect(parser.searchAddresses("test query")).rejects.toThrow(
        "Service unavailable"
      );
    });

    it("should handle initialization errors", async () => {
      const initError = new Error("Failed to create application context");
      vi.mocked(NestFactory.createApplicationContext).mockRejectedValue(
        initError
      );

      await expect(parser.searchAddresses("test query")).rejects.toThrow(
        "Failed to create application context"
      );
    });

    it("should handle module registration errors", async () => {
      const moduleError = new Error("Invalid configuration");
      vi.mocked(QuickrouteAddressParserModule.register).mockImplementation(
        () => {
          throw moduleError;
        }
      );

      await expect(parser.searchAddresses("test query")).rejects.toThrow(
        "Invalid configuration"
      );
    });
  });

  describe("close", () => {
    it("should close application context when initialized", async () => {
      mockService.searchAddresses = vi.fn().mockResolvedValue(mockSearchResult);

      // Initialize by calling searchAddresses
      await parser.searchAddresses("test query");

      // Now close
      await parser.close();

      expect(mockApp.close).toHaveBeenCalled();
    });

    it("should reset internal state after closing", async () => {
      mockService.searchAddresses = vi.fn().mockResolvedValue(mockSearchResult);

      // Initialize
      await parser.searchAddresses("test query");

      // Close
      await parser.close();

      // Should reinitialize on next call
      await parser.searchAddresses("test query 2");

      expect(NestFactory.createApplicationContext).toHaveBeenCalledTimes(2);
    });

    it("should handle close when not initialized", async () => {
      // Should not throw error when closing before initialization
      await expect(parser.close()).resolves.not.toThrow();
      expect(mockApp.close).not.toHaveBeenCalled();
    });

    it("should handle close errors gracefully", async () => {
      mockService.searchAddresses = vi.fn().mockResolvedValue(mockSearchResult);
      const closeError = new Error("Failed to close application");
      mockApp.close = vi.fn().mockRejectedValue(closeError);

      // Initialize
      await parser.searchAddresses("test query");

      // Close should propagate the error
      await expect(parser.close()).rejects.toThrow(
        "Failed to close application"
      );
    });
  });

  describe("configuration handling", () => {
    it("should handle undefined optional config properties", async () => {
      const minimalConfig: StandaloneConfig = {
        apiKey: "test-key",
      };
      const minimalParser = new QuickrouteAddressParser(minimalConfig);
      mockService.searchAddresses = vi.fn().mockResolvedValue(mockSearchResult);

      await minimalParser.searchAddresses("test query");

      expect(QuickrouteAddressParserModule.register).toHaveBeenCalledWith({
        isGlobal: true,
        apiKey: "test-key",
        baseUrl: undefined,
        timeout: undefined,
        retries: undefined,
        loggingConfig: undefined,
      });
    });

    it("should pass through custom logging configuration", async () => {
      const configWithCustomLogging: StandaloneConfig = {
        apiKey: "test-key",
        loggingConfig: {
          enableRequestLogging: true,
          retentionDays: 30,
        },
      };
      const customParser = new QuickrouteAddressParser(configWithCustomLogging);
      mockService.searchAddresses = vi.fn().mockResolvedValue(mockSearchResult);

      await customParser.searchAddresses("test query");

      expect(QuickrouteAddressParserModule.register).toHaveBeenCalledWith(
        expect.objectContaining({
          loggingConfig: {
            enableRequestLogging: true,
            retentionDays: 30,
          },
        })
      );
    });
  });

  describe("lifecycle management", () => {
    it("should support multiple search operations", async () => {
      mockService.searchAddresses = vi.fn().mockResolvedValue(mockSearchResult);

      await parser.searchAddresses("query 1");
      await parser.searchAddresses("query 2");
      await parser.searchAddresses("query 3");

      expect(mockService.searchAddresses).toHaveBeenCalledTimes(3);
      expect(mockService.searchAddresses).toHaveBeenNthCalledWith(
        1,
        "query 1",
        10
      );
      expect(mockService.searchAddresses).toHaveBeenNthCalledWith(
        2,
        "query 2",
        10
      );
      expect(mockService.searchAddresses).toHaveBeenNthCalledWith(
        3,
        "query 3",
        10
      );
    });

    it("should support close and reinitialize cycle", async () => {
      mockService.searchAddresses = vi.fn().mockResolvedValue(mockSearchResult);

      // Initial use
      await parser.searchAddresses("query 1");
      await parser.close();

      // Reuse after close
      await parser.searchAddresses("query 2");
      await parser.close();

      expect(NestFactory.createApplicationContext).toHaveBeenCalledTimes(2);
      expect(mockApp.close).toHaveBeenCalledTimes(2);
    });
  });

  describe("error edge cases", () => {
    it("should handle service returning undefined", async () => {
      mockApp.get = vi.fn().mockReturnValue(undefined);

      await expect(parser.searchAddresses("test query")).rejects.toThrow(
        "Failed to initialize address parser service"
      );
    });

    it("should handle app creation returning null", async () => {
      vi.mocked(NestFactory.createApplicationContext).mockResolvedValue(
        null as any
      );

      await expect(parser.searchAddresses("test query")).rejects.toThrow();
    });
  });
});
