import { describe, it, expect, beforeEach, vi } from "vitest";
import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { EnhancedGlobalExceptionFilter } from "../../src/filters/enhanced-global-exception.filter";
import { ErrorLoggingService } from "../../src/services/error-logging.service";
import { Request, Response } from "express";

describe("EnhancedGlobalExceptionFilter", () => {
  let filter: EnhancedGlobalExceptionFilter;
  let mockErrorLoggingService: Partial<ErrorLoggingService>;
  let mockHttpAdapterHost: Partial<HttpAdapterHost>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockHost: Partial<ArgumentsHost>;
  let mockHttpAdapter: any;

  beforeEach(async () => {
    mockErrorLoggingService = {
      logError: vi.fn(),
      logErrorWithContext: vi.fn(),
    };

    mockHttpAdapter = {
      reply: vi.fn(),
    };

    mockHttpAdapterHost = {
      httpAdapter: mockHttpAdapter,
    };

    const module = await Test.createTestingModule({
      providers: [
        EnhancedGlobalExceptionFilter,
        {
          provide: HttpAdapterHost,
          useValue: mockHttpAdapterHost,
        },
        {
          provide: ErrorLoggingService,
          useValue: mockErrorLoggingService,
        },
      ],
    }).compile();

    filter = module.get<EnhancedGlobalExceptionFilter>(
      EnhancedGlobalExceptionFilter
    );

    mockRequest = {
      url: "/test-endpoint",
      method: "POST",
      ip: "192.168.1.1",
      headers: {
        "user-agent": "test-agent/1.0",
        "x-correlation-id": undefined,
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
    it("should handle HTTP exceptions with full logging", () => {
      const exception = new HttpException(
        "Validation failed",
        HttpStatus.BAD_REQUEST
      );

      filter.catch(exception, mockHost as ArgumentsHost);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            type: "INVALID_INPUT_ERROR",
            message: "Validation failed",
            statusCode: 400,
            path: "/test-endpoint",
            timestamp: expect.any(String),
          }),
        }),
        400
      );
    });

    it("should use existing correlation ID from header", () => {
      const requestWithCorrelationHeader = {
        ...mockRequest,
        headers: {
          ...mockRequest.headers,
          "x-correlation-id": "existing-correlation-id",
        },
      };

      const mockHostWithCorrelation = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue(requestWithCorrelationHeader),
          getResponse: vi.fn().mockReturnValue(mockResponse),
        }),
      };

      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHostWithCorrelation as ArgumentsHost);

      expect(requestWithCorrelationHeader.correlationId).toBe(
        "existing-correlation-id"
      );
    });

    it("should use existing correlation ID from request object", () => {
      const requestWithCorrelation = {
        ...mockRequest,
        correlationId: "request-correlation-id",
      };

      const mockHostWithCorrelation = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue(requestWithCorrelation),
          getResponse: vi.fn().mockReturnValue(mockResponse),
        }),
      };

      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHostWithCorrelation as ArgumentsHost);

      expect(requestWithCorrelation.correlationId).toBe(
        "request-correlation-id"
      );
    });

    it("should generate UUID when no correlation ID exists", () => {
      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost as ArgumentsHost);

      expect(mockRequest.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("should handle non-HTTP context gracefully", () => {
      mockHttpAdapterHost.httpAdapter = undefined;

      const exception = new Error("Non-HTTP error");

      filter.catch(exception, mockHost as ArgumentsHost);

      expect(mockErrorLoggingService.logError).not.toHaveBeenCalled();
      expect(mockHttpAdapter.reply).not.toHaveBeenCalled();
    });

    it("should handle unknown exceptions", () => {
      const unknownException = new Error("Unknown error");

      filter.catch(unknownException, mockHost as ArgumentsHost);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            type: "UNKNOWN_ERROR",
            message: "Internal server error",
          }),
        }),
        500
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

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            type: "COUNTRY_VALIDATION_ERROR",
          }),
        }),
        422
      );
    });

    it("should handle internal server errors (500 status)", () => {
      const serverException = new HttpException(
        "Internal server error",
        HttpStatus.INTERNAL_SERVER_ERROR
      );

      filter.catch(serverException, mockHost as ArgumentsHost);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            type: "HTTP_ERROR",
            message: "Internal server error",
            statusCode: 500,
            path: "/test-endpoint",
            timestamp: expect.any(String),
          }),
        }),
        500
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

      expect(typeof (minimalRequest as any).correlationId).toBe("string");
    });

    it("should set correlation ID on request object", () => {
      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost as ArgumentsHost);

      expect(mockRequest.correlationId).toBeDefined();
      expect(typeof mockRequest.correlationId).toBe("string");
    });

    it("should handle string exceptions", () => {
      const stringException = "String error message";

      filter.catch(stringException, mockHost as ArgumentsHost);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            type: "UNKNOWN_ERROR",
            message: "Internal server error",
          }),
        }),
        500
      );
    });

    it("should handle null/undefined exceptions", () => {
      filter.catch(null, mockHost as ArgumentsHost);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            type: "UNKNOWN_ERROR",
            message: "Internal server error",
          }),
        }),
        500
      );
    });
  });
});
