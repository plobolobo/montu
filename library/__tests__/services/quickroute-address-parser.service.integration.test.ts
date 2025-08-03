import { Test, TestingModule } from "@nestjs/testing";
import { QuickrouteAddressParserService } from "../../src/services/quickroute-address-parser.service";
import { ADDRESS_PROVIDER_TOKEN } from "../../src/constants";
import {
  InvalidInputException,
  NoResultsException,
} from "../../src/exceptions";
import { BadRequestException } from "@nestjs/common";
import { ISuggestion } from "../../src/interfaces";
import { vi, describe, it, expect, beforeEach } from "vitest";

describe("QuickrouteAddressParserService - Integration Tests", () => {
  let service: QuickrouteAddressParserService;
  let mockProvider: any;

  beforeEach(async () => {
    mockProvider = {
      getSuggestions: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuickrouteAddressParserService,
        {
          provide: ADDRESS_PROVIDER_TOKEN,
          useValue: mockProvider,
        },
      ],
    }).compile();

    service = module.get<QuickrouteAddressParserService>(
      QuickrouteAddressParserService
    );
  });

  describe("searchAddresses", () => {
    it("should return suggestions with metadata for valid input", async () => {
      const mockSuggestions: ISuggestion<any>[] = [
        {
          id: "1",
          text: "123 George Street, Sydney NSW 2000, Australia",
          score: 2.98,
          address: {
            fullAddress: "123 George Street, Sydney NSW 2000, Australia",
            state: "NSW",
            postcode: "2000",
            country: "Australia",
            coordinates: { lat: -33.8688, lon: 151.2093 },
          },
        },
      ];

      mockProvider.getSuggestions.mockResolvedValue(mockSuggestions);

      const result = await service.searchAddresses(
        "123 George Street Sydney",
        10
      );

      expect(result.results).toEqual(mockSuggestions);
      expect(result.metadata.query).toBe("123 George Street Sydney");
      expect(result.metadata.limit).toBe(10);
      expect(result.metadata.resultCount).toBe(1);
      expect(result.metadata.warnings).toEqual([]);
      expect(mockProvider.getSuggestions).toHaveBeenCalledWith(
        "123 George Street Sydney",
        10
      );
    });

    it("should include warnings for suboptimal queries", async () => {
      const mockSuggestions: ISuggestion<any>[] = [];
      mockProvider.getSuggestions.mockResolvedValue(mockSuggestions);

      const result = await service.searchAddresses("Syd", 10);

      expect(result.results).toEqual([]);
      expect(result.metadata.warnings.length).toBeGreaterThan(0);
      expect(result.metadata.warnings[0]).toContain("shorter than optimal");
    });

    it("should throw BadRequestException for invalid input", async () => {
      await expect(service.searchAddresses("", 10)).rejects.toThrow(
        BadRequestException
      );
    });

    it("should handle provider errors", async () => {
      mockProvider.getSuggestions.mockRejectedValue(
        new NoResultsException("test query", "TomTom")
      );

      await expect(
        service.searchAddresses("nonexistent address", 10)
      ).rejects.toThrow(NoResultsException);
    });
  });

  describe("input validation", () => {
    it("should validate query length boundaries", async () => {
      // Test minimum length
      await expect(service.searchAddresses("A", 10)).rejects.toThrow(
        BadRequestException
      );

      // Test maximum length
      const longQuery = "A".repeat(201);
      await expect(service.searchAddresses(longQuery, 10)).rejects.toThrow(
        BadRequestException
      );
    });

    it("should validate limit boundaries", async () => {
      // Test minimum limit
      await expect(service.searchAddresses("Sydney", 0)).rejects.toThrow(
        BadRequestException
      );

      // Test maximum limit
      await expect(service.searchAddresses("Sydney", 101)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("getProviderName", () => {
    it("should return the correct provider name", () => {
      const providerName = service.getProviderName();
      expect(providerName).toBe("TomTom");
    });
  });
});
