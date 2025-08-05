import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { QuickrouteAddressParserService } from "../../src/services/quickroute-address-parser.service";
import { IAddressProvider } from "../../src/interfaces";
import { ADDRESS_PROVIDER_TOKEN } from "../../src/constants";
import { AddressResponse } from "../../src/dto";

describe("QuickrouteAddressParserService", () => {
  let service: QuickrouteAddressParserService;
  let mockAddressProvider: Partial<IAddressProvider>;

  const mockAddressResponse: AddressResponse = {
    id: "test-id",
    address: "123 Test Street, Sydney NSW 2000, Australia",
    position: {
      lat: -33.8688,
      lon: 151.2093,
    },
    score: 0.95,
  };

  beforeEach(async () => {
    mockAddressProvider = {
      getSuggestions: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuickrouteAddressParserService,
        {
          provide: ADDRESS_PROVIDER_TOKEN,
          useValue: mockAddressProvider,
        },
      ],
    }).compile();

    service = module.get<QuickrouteAddressParserService>(
      QuickrouteAddressParserService
    );

    // Mock the logger to avoid console output during tests
    vi.spyOn(Logger.prototype, "debug").mockImplementation(() => {});
  });

  describe("searchAddresses", () => {
    it("should successfully search addresses with valid input", async () => {
      const mockResults = [mockAddressResponse];
      mockAddressProvider.getSuggestions = vi
        .fn()
        .mockResolvedValue(mockResults);

      const result = await service.searchAddresses("123 Test Street", 5);

      expect(mockAddressProvider.getSuggestions).toHaveBeenCalledWith(
        "123 Test Street",
        5
      );
      expect(result).toEqual({
        results: mockResults,
        metadata: {
          query: "123 Test Street",
          limit: 5,
          resultCount: 1,
          warnings: [],
        },
      });
    });

    it("should use default limit when not provided", async () => {
      const mockResults = [mockAddressResponse];
      mockAddressProvider.getSuggestions = vi
        .fn()
        .mockResolvedValue(mockResults);

      const result = await service.searchAddresses("123 Test Street");

      expect(mockAddressProvider.getSuggestions).toHaveBeenCalledWith(
        "123 Test Street",
        10
      );
      expect(result.metadata.limit).toBe(10);
    });

    it("should return empty results when no addresses found", async () => {
      mockAddressProvider.getSuggestions = vi.fn().mockResolvedValue([]);

      const result = await service.searchAddresses("Nonexistent Address");

      expect(result).toEqual({
        results: [],
        metadata: {
          query: "Nonexistent Address",
          limit: 10,
          resultCount: 0,
          warnings: [],
        },
      });
    });

    it("should handle multiple results", async () => {
      const mockResults = [
        mockAddressResponse,
        {
          ...mockAddressResponse,
          id: "test-id-2",
          address: "456 Another Street, Melbourne VIC 3000, Australia",
          position: { lat: -37.8136, lon: 144.9631 },
        },
      ];
      mockAddressProvider.getSuggestions = vi
        .fn()
        .mockResolvedValue(mockResults);

      const result = await service.searchAddresses("Test Street", 15);

      expect(result.results).toHaveLength(2);
      expect(result.metadata.resultCount).toBe(2);
      expect(result.metadata.limit).toBe(15);
    });

    it("should validate and sanitize input data", async () => {
      const mockResults = [mockAddressResponse];
      mockAddressProvider.getSuggestions = vi
        .fn()
        .mockResolvedValue(mockResults);

      // Test with padded query that should be trimmed
      const result = await service.searchAddresses("  Test Query  ", 5);

      expect(mockAddressProvider.getSuggestions).toHaveBeenCalledWith(
        "Test Query", // Should be trimmed
        5
      );
      expect(result.metadata.query).toBe("Test Query");
      expect(result.metadata.limit).toBe(5);
    });

    it("should throw validation error for invalid query", async () => {
      await expect(service.searchAddresses("")).rejects.toThrow();
    });

    it("should throw validation error for invalid limit", async () => {
      await expect(service.searchAddresses("Valid Query", 0)).rejects.toThrow();
    });

    it("should throw validation error for limit exceeding maximum", async () => {
      await expect(
        service.searchAddresses("Valid Query", 101)
      ).rejects.toThrow();
    });

    it("should handle provider errors gracefully", async () => {
      const providerError = new Error("Provider connection failed");
      mockAddressProvider.getSuggestions = vi
        .fn()
        .mockRejectedValue(providerError);

      await expect(service.searchAddresses("123 Test Street")).rejects.toThrow(
        "Provider connection failed"
      );

      expect(mockAddressProvider.getSuggestions).toHaveBeenCalledWith(
        "123 Test Street",
        10
      );
    });

    it("should log debug information for search start", async () => {
      const mockResults = [mockAddressResponse];
      mockAddressProvider.getSuggestions = vi
        .fn()
        .mockResolvedValue(mockResults);
      const debugSpy = vi.spyOn(Logger.prototype, "debug");

      await service.searchAddresses("Test Query", 5);

      expect(debugSpy).toHaveBeenCalledWith("Starting address search", {
        query: "Test Query",
        limit: 5,
      });
    });

    it("should log debug information for search completion", async () => {
      const mockResults = [mockAddressResponse];
      mockAddressProvider.getSuggestions = vi
        .fn()
        .mockResolvedValue(mockResults);
      const debugSpy = vi.spyOn(Logger.prototype, "debug");

      await service.searchAddresses("Test Query", 5);

      expect(debugSpy).toHaveBeenCalledWith("Address search completed", {
        query: "Test Query",
        limit: 5,
        resultCount: 1,
      });
    });

    it("should handle warnings in validation result", async () => {
      const mockResults = [mockAddressResponse];
      mockAddressProvider.getSuggestions = vi
        .fn()
        .mockResolvedValue(mockResults);

      // Test with a query that might generate warnings (very short query)
      const result = await service.searchAddresses("ABC");

      expect(result.metadata.warnings).toBeDefined();
      expect(Array.isArray(result.metadata.warnings)).toBe(true);
    });

    it("should handle null warnings gracefully", async () => {
      const mockResults = [mockAddressResponse];
      mockAddressProvider.getSuggestions = vi
        .fn()
        .mockResolvedValue(mockResults);

      const result = await service.searchAddresses("Test Query");

      expect(result.metadata.warnings).toEqual([]);
    });

    it("should inject address provider correctly", () => {
      expect(service).toBeDefined();
      expect(mockAddressProvider.getSuggestions).toBeDefined();
    });

    it("should throw validation error for query exceeding maximum length", async () => {
      const longQuery = "A".repeat(201); // Exceeds MAX_LENGTH of 200

      await expect(service.searchAddresses(longQuery)).rejects.toThrow(
        "Validation failed"
      );
    });

    it("should handle special characters in query", async () => {
      const specialQuery = "123 Main St. & Co., Apt #456 (Rear)";
      const mockResults = [mockAddressResponse];
      mockAddressProvider.getSuggestions = vi
        .fn()
        .mockResolvedValue(mockResults);

      const result = await service.searchAddresses(specialQuery);

      expect(mockAddressProvider.getSuggestions).toHaveBeenCalledWith(
        specialQuery,
        10
      );
      expect(result.metadata.query).toBe(specialQuery);
    });
  });
});
