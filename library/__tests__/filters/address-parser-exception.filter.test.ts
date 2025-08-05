import { describe, it, expect, beforeEach, vi } from "vitest";
import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { AddressParserExceptionFilter } from "../../src/filters/address-parser-exception.filter";
import { Request, Response } from "express";

describe("AddressParserExceptionFilter", () => {
  let filter: AddressParserExceptionFilter;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockHost: Partial<ArgumentsHost>;

  beforeEach(() => {
    filter = new AddressParserExceptionFilter();

    mockRequest = {
      url: "/test-endpoint",
      method: "GET",
      headers: {
        "user-agent": "test-agent/1.0",
      },
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(mockRequest),
        getResponse: vi.fn().mockReturnValue(mockResponse),
      }),
    };
  });

  describe("catch", () => {
    it("should handle HTTP exceptions correctly", () => {
      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            type: "INVALID_INPUT_ERROR",
            message: "Test error",
            statusCode: 400,
            path: "/test-endpoint",
            timestamp: expect.any(String),
          }),
        })
      );
    });

    it("should handle validation errors (422 status)", () => {
      const validationException = new HttpException(
        {
          message: "Validation failed",
          expectedCountry: "AU",
          receivedCountry: "US",
        },
        HttpStatus.UNPROCESSABLE_ENTITY
      );

      filter.catch(validationException, mockHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            type: "COUNTRY_VALIDATION_ERROR",
          }),
        })
      );
    });

    it("should handle not found errors (404 status)", () => {
      const notFoundException = new HttpException(
        "Not found",
        HttpStatus.NOT_FOUND
      );

      filter.catch(notFoundException, mockHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            type: "NOT_FOUND_ERROR",
            message: "Not found",
            statusCode: 404,
            path: "/test-endpoint",
            timestamp: expect.any(String),
          }),
        })
      );
    });

    it("should handle unknown exceptions", () => {
      const unknownException = new Error("Unknown error");

      filter.catch(unknownException, mockHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            type: "UNKNOWN_ERROR",
            message: "Internal server error",
          }),
        })
      );
    });

    it("should include correlation ID when present in request", () => {
      const requestWithCorrelation = {
        ...mockRequest,
        correlationId: "test-correlation-id",
      };

      const mockHostWithCorrelation = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue(requestWithCorrelation),
          getResponse: vi.fn().mockReturnValue(mockResponse),
        }),
      };

      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHostWithCorrelation as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            type: "INVALID_INPUT_ERROR",
            message: "Test error",
            statusCode: 400,
            path: "/test-endpoint",
            timestamp: expect.any(String),
          }),
        })
      );
    });

    it("should handle missing request properties gracefully", () => {
      const minimalRequest = {};
      const mockHostMinimal = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue(minimalRequest),
          getResponse: vi.fn().mockReturnValue(mockResponse),
        }),
      };

      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHostMinimal as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            type: "INVALID_INPUT_ERROR",
            message: "Test error",
            statusCode: 400,
            path: "unknown",
            timestamp: expect.any(String),
          }),
        })
      );
    });

    it("should handle string exceptions", () => {
      const stringException = "String error message";

      filter.catch(stringException, mockHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            type: "UNKNOWN_ERROR",
            message: "Internal server error",
          }),
        })
      );
    });

    it("should handle null/undefined exceptions", () => {
      filter.catch(null, mockHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            type: "UNKNOWN_ERROR",
            message: "Internal server error",
          }),
        })
      );
    });
  });
});
