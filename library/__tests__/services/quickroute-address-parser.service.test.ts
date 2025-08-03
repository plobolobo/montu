import { Test, TestingModule } from "@nestjs/testing";
import { QuickrouteAddressParserService } from "../../src/services/quickroute-address-parser.service";
import { TomTomAddressProvider } from "../../src/providers/tomtom/tomtom-address.provider";
import { ADDRESS_PROVIDER_TOKEN } from "../../src/constants";
import {
  InvalidInputException,
  NoResultsException,
} from "../../src/exceptions";
import { BadRequestException } from "@nestjs/common";
import { ISuggestion } from "../../src/interfaces";
import { vi } from "vitest";

describe("QuickrouteAddressParserService", () => {
  let service: QuickrouteAddressParserService;
  let tomtomProvider: any;

  beforeEach(async () => {
    const mockTomTomProvider = {
      getSuggestions: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuickrouteAddressParserService,
        {
          provide: ADDRESS_PROVIDER_TOKEN,
          useValue: mockTomTomProvider,
        },
      ],
    }).compile();

    service = module.get<QuickrouteAddressParserService>(
      QuickrouteAddressParserService
    );
    tomtomProvider = module.get(ADDRESS_PROVIDER_TOKEN);
  });

  describe("searchAddresses", () => {
    it("should return suggestions for valid input", async () => {
      const mockSuggestions: ISuggestion<any>[] = [
        {
          id: "1",
          fullAddress: "123 George Street, Sydney NSW 2000, Australia",
          coordinates: { latitude: -33.8688, longitude: 151.2093 },
          relevanceScore: 2.98,
          providerData: {},
        },
      ];

      tomtomProvider.getSuggestions.mockResolvedValue(mockSuggestions);

      const result = await service.searchAddresses(
        "123 George Street Sydney",
        10
      );

      expect(result.results).toEqual(mockSuggestions);
      expect(result.metadata.query).toBe("123 George Street Sydney");
      expect(result.metadata.limit).toBe(10);
      expect(result.metadata.resultCount).toBe(1);
      expect(result.metadata.warnings).toEqual([]);
    });

    it("should include warnings for suboptimal queries", async () => {
      const mockSuggestions: ISuggestion<any>[] = [];
      tomtomProvider.getSuggestions.mockResolvedValue(mockSuggestions);

      const result = await service.searchAddresses("Syd", 10);

      expect(result.metadata.warnings.length).toBeGreaterThan(0);
      expect(result.metadata.warnings[0]).toContain("shorter than optimal");
    });

    it("should throw BadRequestException for invalid input", async () => {
      await expect(service.searchAddresses("", 10)).rejects.toThrow(
        BadRequestException
      );
    });

    it("should handle provider errors", async () => {
      tomtomProvider.getSuggestions.mockRejectedValue(
        new NoResultsException("test query", "TomTom")
      );

      await expect(
        service.searchAddresses("nonexistent address", 10)
      ).rejects.toThrow(NoResultsException);
    });

    it("should log search operations", async () => {
      const loggerSpy = vi.spyOn(service["logger"], "debug");

      const mockSuggestions: ISuggestion<any>[] = [];
      tomtomProvider.getSuggestions.mockResolvedValue(mockSuggestions);

      await service.searchAddresses("Sydney", 10);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining("Address search completed"),
        expect.objectContaining({
          query: "Sydney",
          limit: 10,
          resultCount: 0,
        })
      );
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
});
