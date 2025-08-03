import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ArgumentsHost, Logger } from "@nestjs/common";
import { AddressParserExceptionFilter } from "../../src/filters/address-parser-exception.filter";
import { ErrorResponseBuilder, ErrorContext } from "../../src/types";
import { createErrorFromException } from "../../src/mappers";
import {
  ProviderAuthenticationError,
  ProviderRateLimitError,
  CountryMismatchException,
  NoResultsException,
  InvalidInputException,
} from "../../src/exceptions";

vi.mock("../../src/mappers", () => ({
  createErrorFromException: vi.fn(),
}));

vi.mock("../../src/types", () => ({
  ErrorResponseBuilder: {
    create: vi.fn(),
  },
}));

describe("AddressParserExceptionFilter", () => {
  let filter: AddressParserExceptionFilter;
  let mockHost: ArgumentsHost;
  let mockRequest: any;
  let mockResponse: any;
  let mockContext: any;

  const mockErrorMapping = {
    status: 400,
    message: "Test error",
    details: { type: "TEST_ERROR" },
  };

  const mockErrorResponse = {
    success: false,
    error: {
      message: "Test error",
      statusCode: 400,
      timestamp: "2023-01-01T00:00:00.000Z",
      path: "/test",
      type: "TEST_ERROR",
    },
  };

  const mockErrorResponseBuilder = {
    build: vi.fn().mockReturnValue(mockErrorResponse),
    getHttpStatus: vi.fn().mockReturnValue(400),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    (createErrorFromException as any).mockReturnValue(mockErrorMapping);
    (ErrorResponseBuilder.create as any).mockReturnValue(
      mockErrorResponseBuilder
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [AddressParserExceptionFilter],
    }).compile();

    filter = module.get<AddressParserExceptionFilter>(
      AddressParserExceptionFilter
    );

    vi.spyOn(filter["logger"], "error").mockImplementation(() => {});
    vi.spyOn(filter["logger"], "warn").mockImplementation(() => {});
    vi.spyOn(filter["logger"], "debug").mockImplementation(() => {});

    mockRequest = {
      url: "/api/address/search",
      method: "POST",
      headers: {
        "user-agent": "Mozilla/5.0 (Test Browser)",
      },
      correlationId: "test-correlation-123",
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockContext = {
      getRequest: vi.fn().mockReturnValue(mockRequest),
      getResponse: vi.fn().mockReturnValue(mockResponse),
    };

    mockHost = {
      switchToHttp: vi.fn().mockReturnValue(mockContext),
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should be defined", () => {
      expect(filter).toBeDefined();
    });

    it("should have logger with correct name", () => {
      expect(filter["logger"]).toBeInstanceOf(Logger);
    });
  });

  describe("catch method", () => {
    it("should handle basic exceptions", () => {
      const exception = new Error("Test error");

      filter.catch(exception, mockHost);

      expect(mockHost.switchToHttp).toHaveBeenCalled();
      expect(mockContext.getRequest).toHaveBeenCalled();
      expect(mockContext.getResponse).toHaveBeenCalled();
      expect(createErrorFromException).toHaveBeenCalledWith(exception);
      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        mockErrorMapping,
        expect.objectContaining({
          timestamp: expect.any(String),
          path: "/api/address/search",
          method: "POST",
          userAgent: "Mozilla/5.0 (Test Browser)",
          correlationId: "test-correlation-123",
        })
      );
      expect(mockErrorResponseBuilder.build).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it("should create correct error context", () => {
      const exception = new Error("Test error");

      filter.catch(exception, mockHost);

      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        mockErrorMapping,
        expect.objectContaining({
          timestamp: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
          ),
          path: "/api/address/search",
          method: "POST",
          userAgent: "Mozilla/5.0 (Test Browser)",
          correlationId: "test-correlation-123",
        })
      );
    });

    it("should handle missing request properties gracefully", () => {
      const exception = new Error("Test error");
      mockRequest = {};
      mockContext.getRequest.mockReturnValue(mockRequest);

      filter.catch(exception, mockHost);

      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        mockErrorMapping,
        expect.objectContaining({
          path: "unknown",
          method: undefined,
          userAgent: undefined,
          correlationId: undefined,
        })
      );
    });

    it("should handle undefined request URL", () => {
      const exception = new Error("Test error");
      mockRequest.url = undefined;

      filter.catch(exception, mockHost);

      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        mockErrorMapping,
        expect.objectContaining({
          path: "unknown",
        })
      );
    });

    it("should handle missing user-agent header", () => {
      const exception = new Error("Test error");
      mockRequest.headers = {};

      filter.catch(exception, mockHost);

      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        mockErrorMapping,
        expect.objectContaining({
          userAgent: undefined,
        })
      );
    });

    it("should handle undefined headers", () => {
      const exception = new Error("Test error");
      mockRequest.headers = undefined;

      filter.catch(exception, mockHost);

      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        mockErrorMapping,
        expect.objectContaining({
          userAgent: undefined,
        })
      );
    });

    it("should handle provider authentication errors", () => {
      const exception = new ProviderAuthenticationError(
        "TomTom",
        "Invalid API key"
      );

      filter.catch(exception, mockHost);

      expect(createErrorFromException).toHaveBeenCalledWith(exception);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it("should handle provider rate limit errors", () => {
      const exception = new ProviderRateLimitError(
        "TomTom",
        "Too many requests"
      );

      filter.catch(exception, mockHost);

      expect(createErrorFromException).toHaveBeenCalledWith(exception);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it("should handle country mismatch exceptions", () => {
      const exception = new CountryMismatchException(
        "Australia",
        "USA",
        "123 Main St"
      );

      filter.catch(exception, mockHost);

      expect(createErrorFromException).toHaveBeenCalledWith(exception);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it("should handle no results exceptions", () => {
      const exception = new NoResultsException("No results found");

      filter.catch(exception, mockHost);

      expect(createErrorFromException).toHaveBeenCalledWith(exception);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it("should handle invalid input exceptions", () => {
      const exception = new InvalidInputException("Invalid input provided");

      filter.catch(exception, mockHost);

      expect(createErrorFromException).toHaveBeenCalledWith(exception);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it("should handle non-Error exceptions", () => {
      const exception = "String error";

      filter.catch(exception, mockHost);

      expect(createErrorFromException).toHaveBeenCalledWith(exception);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it("should handle null exceptions", () => {
      const exception = null;

      filter.catch(exception, mockHost);

      expect(createErrorFromException).toHaveBeenCalledWith(exception);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it("should handle undefined exceptions", () => {
      const exception = undefined;

      filter.catch(exception, mockHost);

      expect(createErrorFromException).toHaveBeenCalledWith(exception);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it("should handle different HTTP status codes", () => {
      const exception = new Error("Server error");
      mockErrorResponseBuilder.getHttpStatus.mockReturnValue(500);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it("should preserve correlation ID from request", () => {
      const exception = new Error("Test error");
      const customCorrelationId = "custom-correlation-456";
      mockRequest.correlationId = customCorrelationId;

      filter.catch(exception, mockHost);

      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        mockErrorMapping,
        expect.objectContaining({
          correlationId: customCorrelationId,
        })
      );
    });

    it("should handle complex request headers", () => {
      const exception = new Error("Test error");
      mockRequest.headers = {
        "user-agent": "Mozilla/5.0 (Complex Browser) Chrome/91.0",
        accept: "application/json",
        authorization: "Bearer token",
      };

      filter.catch(exception, mockHost);

      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        mockErrorMapping,
        expect.objectContaining({
          userAgent: "Mozilla/5.0 (Complex Browser) Chrome/91.0",
        })
      );
    });

    it("should handle different HTTP methods", () => {
      const exception = new Error("Test error");
      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];

      methods.forEach((method) => {
        mockRequest.method = method;
        vi.clearAllMocks();

        filter.catch(exception, mockHost);

        expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
          mockErrorMapping,
          expect.objectContaining({
            method: method,
          })
        );
      });
    });

    it("should handle different URL paths", () => {
      const exception = new Error("Test error");
      const paths = [
        "/api/address/search",
        "/api/health",
        "/complex/path/with/params?query=test",
        "/",
      ];

      paths.forEach((path) => {
        mockRequest.url = path;
        vi.clearAllMocks();

        filter.catch(exception, mockHost);

        expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
          mockErrorMapping,
          expect.objectContaining({
            path: path,
          })
        );
      });
    });

    it("should generate valid timestamps", () => {
      const exception = new Error("Test error");
      const beforeTime = new Date().toISOString();

      filter.catch(exception, mockHost);

      const afterTime = new Date().toISOString();
      const callArgs = (ErrorResponseBuilder.create as any).mock.calls[0][1];
      const timestamp = callArgs.timestamp;

      expect(timestamp).toBeTypeOf("string");
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
      expect(timestamp >= beforeTime).toBe(true);
      expect(timestamp <= afterTime).toBe(true);
    });
  });

  describe("integration with error mapping", () => {
    it("should pass the correct exception to error mapper", () => {
      const exception = new Error("Specific error message");

      filter.catch(exception, mockHost);

      expect(createErrorFromException).toHaveBeenCalledWith(exception);
      expect(createErrorFromException).toHaveBeenCalledTimes(1);
    });

    it("should use the error mapping result correctly", () => {
      const customErrorMapping = {
        status: 422,
        message: "Custom error message",
        details: { type: "CUSTOM_ERROR", code: "ERR001" },
      };
      (createErrorFromException as any).mockReturnValue(customErrorMapping);

      const exception = new Error("Test error");

      filter.catch(exception, mockHost);

      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        customErrorMapping,
        expect.any(Object)
      );
    });
  });

  describe("integration with error response builder", () => {
    it("should create error response builder with correct parameters", () => {
      const exception = new Error("Test error");

      filter.catch(exception, mockHost);

      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        mockErrorMapping,
        expect.objectContaining({
          timestamp: expect.any(String),
          path: expect.any(String),
          method: expect.any(String),
          userAgent: expect.any(String),
          correlationId: expect.any(String),
        })
      );
    });

    it("should call build method on error response builder", () => {
      const exception = new Error("Test error");

      filter.catch(exception, mockHost);

      expect(mockErrorResponseBuilder.build).toHaveBeenCalledTimes(1);
    });

    it("should call getHttpStatus method on error response builder", () => {
      const exception = new Error("Test error");

      filter.catch(exception, mockHost);

      expect(mockErrorResponseBuilder.getHttpStatus).toHaveBeenCalledTimes(1);
    });

    it("should use the built error response for JSON response", () => {
      const customErrorResponse = {
        success: false,
        error: {
          message: "Custom error",
          statusCode: 422,
          timestamp: "2023-01-01T00:00:00.000Z",
          path: "/custom",
        },
      };
      mockErrorResponseBuilder.build.mockReturnValue(customErrorResponse);

      const exception = new Error("Test error");

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(customErrorResponse);
    });
  });

  describe("error context creation", () => {
    it("should create error context with all available fields", () => {
      const exception = new Error("Test error");
      const fullRequest = {
        url: "/api/test/endpoint",
        method: "PATCH",
        headers: {
          "user-agent": "Test Agent 1.0",
          "x-forwarded-for": "192.168.1.1",
        },
        correlationId: "full-correlation-789",
      };
      mockContext.getRequest.mockReturnValue(fullRequest);

      filter.catch(exception, mockHost);

      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        mockErrorMapping,
        {
          timestamp: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
          ),
          path: "/api/test/endpoint",
          method: "PATCH",
          userAgent: "Test Agent 1.0",
          correlationId: "full-correlation-789",
        }
      );
    });

    it("should handle minimal request information", () => {
      const exception = new Error("Test error");
      const minimalRequest = {};
      mockContext.getRequest.mockReturnValue(minimalRequest);

      filter.catch(exception, mockHost);

      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        mockErrorMapping,
        {
          timestamp: expect.any(String),
          path: "unknown",
          method: undefined,
          userAgent: undefined,
          correlationId: undefined,
        }
      );
    });
  });
});
