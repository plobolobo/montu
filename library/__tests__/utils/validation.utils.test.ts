import {
  validateAddressInput,
  createValidationException,
  getValidatedDataOrThrow,
} from "../../src/utils/validation.utils";
import { BadRequestException } from "@nestjs/common";
import { InvalidInputException } from "../../src/exceptions";

describe("validateAddressInput", () => {
  describe("valid inputs", () => {
    it("should validate correct input", () => {
      const input = { query: "Sydney NSW", limit: 10 };
      const result = validateAddressInput(input);

      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.data.query).toBe("Sydney NSW");
        expect(result.data.limit).toBe(10);
      }
    });

    it("should provide warnings for short queries", () => {
      const input = { query: "Syd", limit: 10 };
      const result = validateAddressInput(input);

      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain("shorter than optimal length");
      }
    });

    it("should provide warnings for long queries", () => {
      const input = {
        query:
          "A very long address query that exceeds the optimal length for better search results and performance optimization and overall system efficiency",
        limit: 10,
      };
      const result = validateAddressInput(input);

      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain("longer than optimal length");
      }
    });
  });

  describe("invalid inputs", () => {
    it("should reject empty query", () => {
      const input = { query: "", limit: 10 };
      const result = validateAddressInput(input);

      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].field).toBe("query");
      }
    });

    it("should reject query that is too short", () => {
      const input = { query: "A", limit: 10 };
      const result = validateAddressInput(input);

      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it("should reject limit that is too low", () => {
      const input = { query: "Sydney NSW", limit: 0 };
      const result = validateAddressInput(input);

      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].field).toBe("limit");
      }
    });

    it("should reject limit that is too high", () => {
      const input = { query: "Sydney NSW", limit: 1000 };
      const result = validateAddressInput(input);

      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].field).toBe("limit");
      }
    });
  });
});

describe("createValidationException", () => {
  it("should create BadRequestException from validation error", () => {
    const validationError = {
      isValid: false as const,
      errors: [
        {
          field: "query",
          message: "String must contain at least 3 character(s)",
          code: "too_small",
        },
      ],
    };

    const exception = createValidationException(validationError);

    expect(exception).toBeInstanceOf(BadRequestException);
    const response = exception.getResponse();
    expect(
      typeof response === "object" && response !== null && "message" in response
    ).toBe(true);
  });
});

describe("getValidatedDataOrThrow", () => {
  it("should return data for valid input", () => {
    const input = { query: "Sydney NSW", limit: 10 };
    const result = getValidatedDataOrThrow(input);

    expect(result.data.query).toBe("Sydney NSW");
    expect(result.data.limit).toBe(10);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("should throw exception for invalid input", () => {
    const input = { query: "", limit: 10 };

    expect(() => getValidatedDataOrThrow(input)).toThrow(BadRequestException);
  });
});
