import { describe, it, expect } from "vitest";
import { AddressSearchSchema } from "../../src/dto";

describe("AddressSearchDto", () => {
  describe("Country validation", () => {
    it("should allow search without country specified", () => {
      const searchData = {
        query: "123 Main Street",
        limit: 10,
      };
      const result = AddressSearchSchema.safeParse(searchData);
      expect(result.success).toBe(true);
    });

    it("should allow valid Australian country values", () => {
      const validCountries = [
        "Australia",
        "AU",
        "AUS",
        "australia",
        "au",
        "aus",
      ];

      for (const country of validCountries) {
        const searchData = {
          query: "123 Main Street",
          limit: 10,
          country,
        };
        const result = AddressSearchSchema.safeParse(searchData);
        expect(result.success).toBe(true);
      }
    });

    it("should reject non-Australian countries", () => {
      const invalidCountries = [
        "US",
        "USA",
        "United States",
        "UK",
        "Canada",
        "Germany",
      ];

      for (const country of invalidCountries) {
        const searchData = {
          query: "123 Main Street",
          limit: 10,
          country,
        };
        const result = AddressSearchSchema.safeParse(searchData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain(
            "Only Australian addresses are supported"
          );
        }
      }
    });

    it("should handle country with whitespace", () => {
      const searchData = {
        query: "123 Main Street",
        limit: 10,
        country: "  Australia  ",
      };
      const result = AddressSearchSchema.safeParse(searchData);
      expect(result.success).toBe(true);
    });

    it("should reject empty country string", () => {
      const searchData = {
        query: "123 Main Street",
        limit: 10,
        country: "",
      };
      const result = AddressSearchSchema.safeParse(searchData);
      expect(result.success).toBe(false);
    });
  });

  describe("Basic validation", () => {
    it("should validate complete valid search data", () => {
      const searchData = {
        query: "123 Main Street",
        limit: 10,
        country: "Australia",
      };
      const result = AddressSearchSchema.safeParse(searchData);
      expect(result.success).toBe(true);
    });

    it("should apply default limit", () => {
      const searchData = {
        query: "123 Main Street",
      };
      const result = AddressSearchSchema.safeParse(searchData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it("should reject query that is too short", () => {
      const searchData = {
        query: "a", // Too short
        limit: 10,
      };
      const result = AddressSearchSchema.safeParse(searchData);
      expect(result.success).toBe(false);
    });

    it("should reject limit that is too high", () => {
      const searchData = {
        query: "123 Main Street",
        limit: 101, // Too high
      };
      const result = AddressSearchSchema.safeParse(searchData);
      expect(result.success).toBe(false);
    });
  });
});
