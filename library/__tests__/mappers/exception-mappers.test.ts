import { describe, it, expect } from "vitest";
import { HttpStatus, HttpException } from "@nestjs/common";
import { createErrorFromException } from "../../src/mappers/exception-mappers";
import {
  CountryMismatchException,
  NoResultsException,
  ConfigurationException,
  InvalidInputException,
  ProviderAuthenticationError,
  ProviderRateLimitError,
} from "../../src/exceptions";

describe("Exception Mappers", () => {
  describe("createErrorFromException", () => {
    describe("CountryMismatchException", () => {
      it("should map CountryMismatchException with correct details", () => {
        const exception = new CountryMismatchException(
          "Australia",
          "Canada", 
          "123 Main St, Sydney"
        );

        const result = createErrorFromException(exception);

        expect(result).toEqual({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'Address validation failed: Expected Australia address, received Canada for "123 Main St, Sydney"',
          details: {
            expectedCountry: "Australia",
            actualCountry: "Canada", 
            query: "123 Main St, Sydney",
            type: "COUNTRY_VALIDATION_ERROR",
          },
        });
      });

      it("should handle CountryMismatchException with undefined countries", () => {
        const exception = new CountryMismatchException(
          undefined,
          undefined,
          "Invalid address"
        );

        const result = createErrorFromException(exception);

        expect(result.details).toEqual({
          expectedCountry: undefined,
          actualCountry: undefined,
          query: "Invalid address",
          type: "COUNTRY_VALIDATION_ERROR",
        });
      });
    });

    describe("NoResultsException", () => {
      it("should map NoResultsException correctly", () => {
        const exception = new NoResultsException("123 Main St");

        const result = createErrorFromException(exception);

        expect(result).toEqual({
          status: HttpStatus.NOT_FOUND,
          message: 'No address suggestions found for query: "123 Main St"',
          details: {
            type: "NO_RESULTS_FOUND",
          },
        });
      });

      it("should handle NoResultsException with provider", () => {
        const exception = new NoResultsException("123 Main St", "TomTom");

        const result = createErrorFromException(exception);

        expect(result.status).toBe(HttpStatus.NOT_FOUND);
        expect(result.message).toBe('No address suggestions found for query: "123 Main St" (TomTom)');
        expect(result.details.type).toBe("NO_RESULTS_FOUND");
      });
    });

    describe("ConfigurationException", () => {
      it("should map ConfigurationException correctly", () => {
        const exception = new ConfigurationException("Missing API key configuration");

        const result = createErrorFromException(exception);

        expect(result).toEqual({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Configuration error: Missing API key configuration",
          details: {
            type: "CONFIGURATION_ERROR",
          },
        });
      });
    });

    describe("InvalidInputException", () => {
      it("should map InvalidInputException with validation details", () => {
        const exception = new InvalidInputException("Invalid input provided");
        // Add input and validation errors as they would be in real usage
        (exception as any).input = { query: "", limit: -1 };
        (exception as any).validationErrors = ["Query cannot be empty", "Limit must be positive"];

        const result = createErrorFromException(exception);

        expect(result).toEqual({
          status: HttpStatus.BAD_REQUEST,
          message: "Invalid input: Invalid input provided",
          details: {
            type: "INVALID_INPUT_ERROR",
            input: { query: "", limit: -1 },
            validationErrors: ["Query cannot be empty", "Limit must be positive"],
          },
        });
      });

      it("should handle InvalidInputException without validation details", () => {
        const exception = new InvalidInputException("Simple validation error");

        const result = createErrorFromException(exception);

        expect(result.details).toEqual({
          type: "INVALID_INPUT_ERROR",
          input: undefined,
          validationErrors: undefined,
        });
      });
    });

    describe("Provider Exceptions (from HTTP interceptor)", () => {
      it("should map ProviderAuthenticationError as HTTP error", () => {
        const exception = new ProviderAuthenticationError("TomTom", "Invalid API key");

        const result = createErrorFromException(exception);

        expect(result.status).toBe(HttpStatus.UNAUTHORIZED);
        expect(result.message).toContain("TomTom authentication failed");
        expect(result.details.type).toBe("HTTP_ERROR");
      });

      it("should map ProviderRateLimitError as HTTP error", () => {
        const exception = new ProviderRateLimitError("TomTom", "Too many requests");

        const result = createErrorFromException(exception);

        expect(result.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(result.message).toContain("TomTom rate limit exceeded");
        expect(result.details.type).toBe("HTTP_ERROR");
      });
    });

    describe("Generic HttpException", () => {
      it("should map generic HttpException with object response", () => {
        const response = {
          error: "Validation failed",
          details: ["Field is required"],
          timestamp: "2023-01-01T00:00:00Z",
        };
        const exception = new HttpException(response, HttpStatus.UNPROCESSABLE_ENTITY);

        const result = createErrorFromException(exception);

        expect(result).toEqual({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          message: "Http Exception",
          details: {
            ...response,
            type: "HTTP_ERROR",
          },
        });
      });

      it("should map generic HttpException with string response", () => {
        const exception = new HttpException("Simple error message", HttpStatus.FORBIDDEN);

        const result = createErrorFromException(exception);

        expect(result).toEqual({
          status: HttpStatus.FORBIDDEN,
          message: "Simple error message",
          details: {
            message: "Simple error message",
            type: "HTTP_ERROR",
          },
        });
      });

      it("should handle custom HttpException with message", () => {
        class CustomHttpException extends HttpException {
          constructor() {
            super("Custom error occurred", HttpStatus.CONFLICT);
          }
        }

        const exception = new CustomHttpException();
        const result = createErrorFromException(exception);

        expect(result.status).toBe(HttpStatus.CONFLICT);
        expect(result.message).toBe("Custom error occurred");
        expect(result.details.type).toBe("HTTP_ERROR");
      });
    });

    describe("Unknown Exceptions", () => {
      it("should map regular Error to unknown error", () => {
        const exception = new Error("Unexpected error occurred");

        const result = createErrorFromException(exception);

        expect(result).toEqual({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Internal server error",
          details: {
            type: "UNKNOWN_ERROR",
          },
        });
      });

      it("should map string error to unknown error", () => {
        const exception = "Something went wrong";

        const result = createErrorFromException(exception);

        expect(result).toEqual({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Internal server error",
          details: {
            type: "UNKNOWN_ERROR",
          },
        });
      });

      it("should map null/undefined to unknown error", () => {
        const nullResult = createErrorFromException(null);
        const undefinedResult = createErrorFromException(undefined);

        expect(nullResult).toEqual({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Internal server error",
          details: {
            type: "UNKNOWN_ERROR",
          },
        });

        expect(undefinedResult).toEqual(nullResult);
      });

      it("should map object without Error prototype to unknown error", () => {
        const exception = { 
          someProperty: "value",
          anotherProperty: 123 
        };

        const result = createErrorFromException(exception);

        expect(result).toEqual({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Internal server error",
          details: {
            type: "UNKNOWN_ERROR",
          },
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle HttpException with empty response", () => {
        const exception = new HttpException("", HttpStatus.BAD_REQUEST);

        const result = createErrorFromException(exception);

        expect(result.status).toBe(HttpStatus.BAD_REQUEST);
        expect(result.details.type).toBe("HTTP_ERROR");
      });

      it("should handle HttpException with complex nested response", () => {
        const response = {
          error: "Validation Error",
          data: {
            field1: ["Error 1", "Error 2"],
            field2: ["Error 3"],
            nested: {
              level2: {
                value: "deep error"
              }
            }
          },
          metadata: {
            timestamp: Date.now(),
            version: "1.0.0"
          }
        };
        
        const exception = new HttpException(response, HttpStatus.BAD_REQUEST);
        const result = createErrorFromException(exception);

        expect(result.details).toEqual({
          ...response,
          type: "HTTP_ERROR",
        });
      });

      it("should preserve all exception properties in business logic exceptions", () => {
        // Test that all specific exception properties are preserved
        const countryException = new CountryMismatchException(
          "Test address",
          "Australia", 
          "USA"
        );

        const result = createErrorFromException(countryException);

        // Verify all expected properties are preserved
        expect(result.details).toHaveProperty("expectedCountry");
        expect(result.details).toHaveProperty("actualCountry");
        expect(result.details).toHaveProperty("query");
        expect(result.details).toHaveProperty("type");
        expect(Object.keys(result.details)).toHaveLength(4);
      });
    });
  });
});