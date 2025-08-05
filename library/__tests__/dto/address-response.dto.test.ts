import { describe, it, expect } from "vitest";
import {
  AddressResponseSchema,
  CoordinatesSchema,
  SearchResponseSchema,
  ExtendedSearchResponseSchema,
} from "../../src/dto";

describe("Address Response DTOs", () => {
  describe("CoordinatesSchema", () => {
    it("should validate valid coordinates", () => {
      const validCoords = { lat: -33.8688, lon: 151.2093 };
      const result = CoordinatesSchema.safeParse(validCoords);
      expect(result.success).toBe(true);
    });

    it("should reject invalid latitude", () => {
      const invalidCoords = { lat: 91, lon: 151.2093 };
      const result = CoordinatesSchema.safeParse(invalidCoords);
      expect(result.success).toBe(false);
    });

    it("should reject invalid longitude", () => {
      const invalidCoords = { lat: -33.8688, lon: 181 };
      const result = CoordinatesSchema.safeParse(invalidCoords);
      expect(result.success).toBe(false);
    });
  });

  describe("AddressResponseSchema", () => {
    const validAddress = {
      id: "addr_123",
      fullAddress: "123 Main St, Sydney NSW 2000, Australia",
      streetNumber: "123",
      streetName: "Main St",
      suburb: "Sydney",
      municipality: "Sydney",
      state: "NSW",
      postcode: "2000",
      country: "Australia",
      coordinates: { lat: -33.8688, lon: 151.2093 },
      confidence: 0.95,
    };

    it("should validate a complete valid address", () => {
      const result = AddressResponseSchema.safeParse(validAddress);
      expect(result.success).toBe(true);
    });

    it("should validate an address without optional fields", () => {
      const minimalAddress = {
        id: "addr_123",
        fullAddress: "123 Main St, Sydney NSW 2000, Australia",
        state: "NSW",
        postcode: "2000",
        country: "Australia",
        coordinates: { lat: -33.8688, lon: 151.2093 },
      };
      const result = AddressResponseSchema.safeParse(minimalAddress);
      expect(result.success).toBe(true);
    });

    it("should reject invalid postcode format", () => {
      const invalidAddress = {
        ...validAddress,
        postcode: "12345",
      };
      const result = AddressResponseSchema.safeParse(invalidAddress);
      expect(result.success).toBe(false);
    });

    it("should reject invalid state", () => {
      const invalidAddress = {
        ...validAddress,
        state: "XYZ",
      };
      const result = AddressResponseSchema.safeParse(invalidAddress);
      expect(result.success).toBe(false);
    });
  });

  describe("SearchResponseSchema", () => {
    const validResponse = {
      results: [
        {
          id: "addr_123",
          fullAddress: "123 Main St, Sydney NSW 2000, Australia",
          state: "NSW",
          postcode: "2000",
          country: "Australia",
          coordinates: { lat: -33.8688, lon: 151.2093 },
        },
      ],
      metadata: {
        query: "123 Main St",
        limit: 10,
        resultCount: 1,
        provider: "TomTom",
        processingTime: 250,
        correlationId: "req_123",
        warnings: [],
      },
      success: true,
    };

    it("should validate a complete search response", () => {
      const result = SearchResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it("should default success to true", () => {
      const responseWithoutSuccess = {
        results: validResponse.results,
        metadata: validResponse.metadata,
      };
      const result = ExtendedSearchResponseSchema.safeParse(
        responseWithoutSuccess
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
      }
    });
  });
});
