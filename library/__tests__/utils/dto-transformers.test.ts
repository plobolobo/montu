import { describe, it, expect } from "vitest";
import {
  transformSuggestionToDto,
  transformSuggestionsToDto,
  createSearchResponseDto,
} from "../../src/utils/dto-transformers";
import { ISuggestion, IAddress, ICoordinates } from "../../src/interfaces";
import { AddressResponseDto, SearchResponseDto } from "../../src/dto";

describe("DTO Transformers", () => {
  // Mock data setup
  const mockCoordinates: ICoordinates = {
    lat: -33.8688,
    lon: 151.2093,
  };

  const mockAddress: IAddress = {
    fullAddress: "123 George Street, Sydney NSW 2000, Australia",
    streetNumber: "123",
    streetName: "George Street",
    suburb: "Sydney",
    municipality: "Sydney",
    state: "NSW",
    postcode: "2000",
    country: "Australia",
    coordinates: mockCoordinates,
    raw: {
      someProviderData: "test",
    },
  };

  const mockSuggestion: ISuggestion = {
    id: "test-suggestion-1",
    text: "123 George Street, Sydney NSW 2000",
    score: 0.95,
    address: mockAddress,
  };

  describe("transformSuggestionToDto", () => {
    it("should transform suggestion to DTO with correct structure", () => {
      const result = transformSuggestionToDto(mockSuggestion);

      expect(result).toEqual({
        id: "test-suggestion-1",
        fullAddress: "123 George Street, Sydney NSW 2000, Australia",
        streetNumber: "123",
        streetName: "George Street",
        suburb: "Sydney",
        municipality: "Sydney",
        state: "NSW",
        postcode: "2000",
        country: "Australia",
        coordinates: mockCoordinates,
        confidence: 0.95,
      });
    });

    it("should handle suggestion with minimal address data", () => {
      const minimalAddress: IAddress = {
        fullAddress: "Sydney NSW 2000",
        streetNumber: undefined,
        streetName: undefined,
        suburb: "Sydney",
        municipality: "Sydney",
        state: "NSW",
        postcode: "2000",
        country: "Australia",
        coordinates: mockCoordinates,
        raw: {},
      };

      const minimalSuggestion: ISuggestion = {
        id: "minimal-test",
        text: "Sydney",
        score: 0.75,
        address: minimalAddress,
      };

      const result = transformSuggestionToDto(minimalSuggestion);

      expect(result).toEqual({
        id: "minimal-test",
        fullAddress: "Sydney NSW 2000",
        streetNumber: undefined,
        streetName: undefined,
        suburb: "Sydney",
        municipality: "Sydney",
        state: "NSW",
        postcode: "2000",
        country: "Australia",
        coordinates: mockCoordinates,
        confidence: 0.75,
      });
    });

    it("should handle suggestion with different score values", () => {
      const testCases = [
        { score: 0.0, expected: 0.0 },
        { score: 0.5, expected: 0.5 },
        { score: 1.0, expected: 1.0 },
        { score: 0.85, expected: 0.85 },
      ];

      testCases.forEach(({ score, expected }) => {
        const suggestion = { ...mockSuggestion, score };
        const result = transformSuggestionToDto(suggestion);
        expect(result.confidence).toBe(expected);
      });
    });

    it("should preserve coordinates exactly", () => {
      const differentCoords: ICoordinates = {
        lat: -37.8136,
        lon: 144.9631,
      };

      const suggestionWithDifferentCoords = {
        ...mockSuggestion,
        address: {
          ...mockAddress,
          coordinates: differentCoords,
        },
      };

      const result = transformSuggestionToDto(suggestionWithDifferentCoords);
      expect(result.coordinates).toEqual(differentCoords);
      expect(result.coordinates.lat).toBe(-37.8136);
      expect(result.coordinates.lon).toBe(144.9631);
    });

    it("should validate schema compliance", () => {
      const result = transformSuggestionToDto(mockSuggestion);

      // Check that all required fields are present
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("fullAddress");
      expect(result).toHaveProperty("coordinates");
      expect(result).toHaveProperty("confidence");

      // Check that coordinates have required lat/lon
      expect(result.coordinates).toHaveProperty("lat");
      expect(result.coordinates).toHaveProperty("lon");
      expect(typeof result.coordinates.lat).toBe("number");
      expect(typeof result.coordinates.lon).toBe("number");
    });

    it("should handle generic type parameter correctly", () => {
      interface CustomRawData {
        providerId: string;
        customField: number;
      }

      const customAddress: IAddress<CustomRawData> = {
        ...mockAddress,
        raw: {
          providerId: "custom-123",
          customField: 42,
        },
      };

      const customSuggestion: ISuggestion<CustomRawData> = {
        ...mockSuggestion,
        address: customAddress,
      };

      const result = transformSuggestionToDto<CustomRawData>(customSuggestion);

      // Should work the same regardless of raw data type
      expect(result.id).toBe(mockSuggestion.id);
      expect(result.confidence).toBe(mockSuggestion.score);
    });
  });

  describe("transformSuggestionsToDto", () => {
    it("should transform empty array", () => {
      const result = transformSuggestionsToDto([]);
      expect(result).toEqual([]);
    });

    it("should transform single suggestion", () => {
      const result = transformSuggestionsToDto([mockSuggestion]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("test-suggestion-1");
    });

    it("should transform multiple suggestions", () => {
      const suggestion2: ISuggestion = {
        id: "test-suggestion-2",
        text: "456 Collins Street, Melbourne",
        score: 0.88,
        address: {
          ...mockAddress,
          fullAddress: "456 Collins Street, Melbourne VIC 3000, Australia",
          streetNumber: "456",
          streetName: "Collins Street",
          suburb: "Melbourne",
          municipality: "Melbourne",
          state: "VIC",
          postcode: "3000",
          coordinates: { lat: -37.8136, lon: 144.9631 },
        },
      };

      const result = transformSuggestionsToDto([mockSuggestion, suggestion2]);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("test-suggestion-1");
      expect(result[0].confidence).toBe(0.95);
      expect(result[1].id).toBe("test-suggestion-2");
      expect(result[1].confidence).toBe(0.88);
    });

    it("should preserve order of suggestions", () => {
      const suggestions = Array.from({ length: 5 }, (_, i) => ({
        ...mockSuggestion,
        id: `suggestion-${i}`,
        score: i * 0.2,
      }));

      const result = transformSuggestionsToDto(suggestions);

      expect(result).toHaveLength(5);
      result.forEach((dto, index) => {
        expect(dto.id).toBe(`suggestion-${index}`);
        expect(dto.confidence).toBe(index * 0.2);
      });
    });
  });

  describe("createSearchResponseDto", () => {
    const mockAddressDto: AddressResponseDto = {
      id: "addr-1",
      fullAddress: "123 George Street, Sydney NSW 2000, Australia",
      streetNumber: "123",
      streetName: "George Street",
      suburb: "Sydney",
      municipality: "Sydney",
      state: "NSW",
      postcode: "2000",
      country: "Australia",
      coordinates: mockCoordinates,
      confidence: 0.95,
    };

    const baseMetadata = {
      query: "123 George Street Sydney",
      limit: 5,
      provider: "TomTom",
      processingTime: 150,
      correlationId: "test-correlation-123",
    };

    it("should create search response with single result", () => {
      const result = createSearchResponseDto([mockAddressDto], baseMetadata);

      expect(result).toEqual({
        results: [mockAddressDto],
        metadata: {
          ...baseMetadata,
          resultCount: 1,
          warnings: [],
        },
        success: true,
      });
    });

    it("should create search response with multiple results", () => {
      const addressDto2: AddressResponseDto = {
        ...mockAddressDto,
        id: "addr-2",
        confidence: 0.85,
      };

      const result = createSearchResponseDto(
        [mockAddressDto, addressDto2],
        baseMetadata
      );

      expect(result.results).toHaveLength(2);
      expect(result.metadata.resultCount).toBe(2);
      expect(result.success).toBe(true);
    });

    it("should create search response with empty results", () => {
      const result = createSearchResponseDto([], baseMetadata);

      expect(result.results).toEqual([]);
      expect(result.metadata.resultCount).toBe(0);
      expect(result.success).toBe(true);
    });

    it("should handle metadata with warnings", () => {
      const metadataWithWarnings = {
        ...baseMetadata,
        warnings: ["Query too short", "Limited results available"],
      };

      const result = createSearchResponseDto(
        [mockAddressDto],
        metadataWithWarnings
      );

      expect(result.metadata.warnings).toEqual([
        "Query too short",
        "Limited results available",
      ]);
      expect(result.metadata.resultCount).toBe(1);
    });

    it("should handle metadata without warnings", () => {
      const result = createSearchResponseDto([mockAddressDto], baseMetadata);

      expect(result.metadata.warnings).toEqual([]);
    });

    it("should preserve all metadata fields", () => {
      const extendedMetadata = {
        ...baseMetadata,
        processingTime: 250,
        correlationId: "extended-correlation-456",
        warnings: ["Test warning"],
      };

      const result = createSearchResponseDto(
        [mockAddressDto],
        extendedMetadata
      );

      expect(result.metadata.query).toBe("123 George Street Sydney");
      expect(result.metadata.limit).toBe(5);
      expect(result.metadata.provider).toBe("TomTom");
      expect(result.metadata.processingTime).toBe(250);
      expect(result.metadata.correlationId).toBe("extended-correlation-456");
      expect(result.metadata.warnings).toEqual(["Test warning"]);
    });

    it("should calculate resultCount correctly for various result sizes", () => {
      const testCases = [
        { results: [], expectedCount: 0 },
        { results: [mockAddressDto], expectedCount: 1 },
        {
          results: Array(10)
            .fill(mockAddressDto)
            .map((dto, i) => ({ ...dto, id: `addr-${i}` })),
          expectedCount: 10,
        },
      ];

      testCases.forEach(({ results, expectedCount }) => {
        const result = createSearchResponseDto(results, baseMetadata);
        expect(result.metadata.resultCount).toBe(expectedCount);
        expect(result.results).toHaveLength(expectedCount);
      });
    });

    it("should validate schema compliance", () => {
      const result = createSearchResponseDto([mockAddressDto], baseMetadata);

      // Check main structure
      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("metadata");
      expect(result).toHaveProperty("success");

      // Check metadata structure
      expect(result.metadata).toHaveProperty("query");
      expect(result.metadata).toHaveProperty("limit");
      expect(result.metadata).toHaveProperty("provider");
      expect(result.metadata).toHaveProperty("processingTime");
      expect(result.metadata).toHaveProperty("correlationId");
      expect(result.metadata).toHaveProperty("resultCount");
      expect(result.metadata).toHaveProperty("warnings");

      // Check types
      expect(typeof result.success).toBe("boolean");
      expect(Array.isArray(result.results)).toBe(true);
      expect(Array.isArray(result.metadata.warnings)).toBe(true);
      expect(typeof result.metadata.resultCount).toBe("number");
    });
  });
});
