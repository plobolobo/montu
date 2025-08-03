import { describe, it, expect } from "vitest";
import { validateAddressInput } from "../../src/utils/validation.utils";

describe("Country Validation Integration", () => {
  describe("validateAddressInput with country parameter", () => {
    it("should accept valid search without country", () => {
      const input = {
        query: "123 Main Street",
        limit: 10,
      };

      const result = validateAddressInput(input);
      expect(result.isValid).toBe(true);

      if (result.isValid) {
        expect(result.data.query).toBe("123 Main Street");
        expect(result.data.limit).toBe(10);
        expect(result.data.country).toBeUndefined();
      }
    });

    it("should accept valid Australian country values", () => {
      const validCountries = ["Australia", "AU", "AUS", "australia", "au"];

      for (const country of validCountries) {
        const input = {
          query: "123 Main Street",
          limit: 10,
          country,
        };

        const result = validateAddressInput(input);
        expect(result.isValid).toBe(true);

        if (result.isValid) {
          expect(result.data.country).toBe(country);
        }
      }
    });

    it("should reject non-Australian countries with descriptive error", () => {
      const invalidCountries = ["US", "USA", "United States", "Canada", "UK"];

      for (const country of invalidCountries) {
        const input = {
          query: "123 Main Street",
          limit: 10,
          country,
        };

        const result = validateAddressInput(input);
        expect(result.isValid).toBe(false);

        if (!result.isValid) {
          expect(result.errors).toHaveLength(1);
          expect(result.errors[0].field).toBe("country");
          expect(result.errors[0].message).toContain(
            "Only Australian addresses are supported"
          );
          expect(result.errors[0].message).toContain("Australia, AU, AUS");
        }
      }
    });

    it("should handle country validation alongside other validation errors", () => {
      const input = {
        query: "a",
        limit: 101,
        country: "US",
      };

      const result = validateAddressInput(input);
      expect(result.isValid).toBe(false);

      if (!result.isValid) {
        expect(result.errors.length).toBeGreaterThan(1);

        const countryError = result.errors.find((e) => e.field === "country");
        expect(countryError).toBeDefined();
        expect(countryError?.message).toContain(
          "Only Australian addresses are supported"
        );

        const queryError = result.errors.find((e) => e.field === "query");
        expect(queryError).toBeDefined();

        const limitError = result.errors.find((e) => e.field === "limit");
        expect(limitError).toBeDefined();
      }
    });

    it("should trim whitespace from country values", () => {
      const input = {
        query: "123 Main Street",
        limit: 10,
        country: "  Australia  ",
      };

      const result = validateAddressInput(input);
      expect(result.isValid).toBe(true);

      if (result.isValid) {
        expect(result.data.country).toBe("Australia");
      }
    });
  });
});
