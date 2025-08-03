import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { EnhancedGlobalExceptionFilter } from "../../src/filters/enhanced-global-exception.filter";
import { ErrorLoggingService } from "../../src/services/error-logging.service";
import { ErrorResponseBuilder, ErrorContext } from "../../src/types";
import { createErrorFromException } from "../../src/mappers";
import {
  ProviderAuthenticationError,
  ProviderServiceError,
  CountryMismatchException,
  InvalidInputException,
} from "../../src/exceptions";
import {
  createMockArgumentsHost,
  createMockRequest,
  createMockResponse,
  createMockErrorMapping,
  createMockErrorResponseBuilder,
  createMockHttpAdapterHost,
  createException,
  setupMockForLogging,
  standardAfterEach,
  validationPatterns,
} from "../utils";

// Mock the dependencies
vi.mock("../../src/mappers", () => ({
  createErrorFromException: vi.fn(),
}));

vi.mock("../../src/types", () => ({
  ErrorResponseBuilder: {
    create: vi.fn(),
  },
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-1234"),
}));

describe("EnhancedGlobalExceptionFilter", () => {
  let filter: EnhancedGlobalExceptionFilter;
  let httpAdapterHost: HttpAdapterHost;
  let errorLoggingService: ErrorLoggingService;
  let mockHost: ArgumentsHost;
  let mockRequest: any;
  let mockResponse: any;
  let mockErrorMapping: any;
  let mockErrorResponseBuilder: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock objects using factories
    mockRequest = createMockRequest({
      correlationId: "existing-correlation-123",
    });
    mockResponse = createMockResponse();
    mockHost = createMockArgumentsHost(mockRequest, mockResponse);
    mockErrorMapping = createMockErrorMapping();
    mockErrorResponseBuilder = createMockErrorResponseBuilder();

    // Setup mock implementations
    (createErrorFromException as any).mockReturnValue(mockErrorMapping);
    (ErrorResponseBuilder.create as any).mockReturnValue(
      mockErrorResponseBuilder
    );

    // Mock services using factories
    const mockErrorLoggingService = {
      logError: vi.fn(),
      logWarning: vi.fn(),
    };

    const mockHttpAdapterHost = createMockHttpAdapterHost();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnhancedGlobalExceptionFilter,
        { provide: HttpAdapterHost, useValue: mockHttpAdapterHost },
        { provide: ErrorLoggingService, useValue: mockErrorLoggingService },
      ],
    }).compile();

    filter = module.get<EnhancedGlobalExceptionFilter>(
      EnhancedGlobalExceptionFilter
    );
    httpAdapterHost = module.get<HttpAdapterHost>(HttpAdapterHost);
    errorLoggingService = module.get<ErrorLoggingService>(ErrorLoggingService);

    // Mock logger to avoid console output using utility
    vi.spyOn(filter["logger"], "error").mockImplementation(() => {});
    vi.spyOn(filter["logger"], "warn").mockImplementation(() => {});
    vi.spyOn(filter["logger"], "debug").mockImplementation(() => {});
  });

  afterEach(standardAfterEach);

  describe("constructor", () => {
    it("should be defined", () => {
      expect(filter).toBeDefined();
    });

    it("should inject dependencies correctly", () => {
      expect(filter["httpAdapterHost"]).toBe(httpAdapterHost);
      expect(filter["errorLoggingService"]).toBe(errorLoggingService);
    });

    it("should have logger with correct name", () => {
      expect(filter["logger"]).toBeInstanceOf(Logger);
    });
  });

  describe("catch method", () => {
    it("should handle exceptions with HTTP adapter available", () => {
      const exception = new Error("Test error");
      setupMockForLogging(mockErrorResponseBuilder);

      filter.catch(exception, mockHost);

      expect(mockHost.switchToHttp).toHaveBeenCalled();
      expect(createErrorFromException).toHaveBeenCalledWith(exception);
      expect(ErrorResponseBuilder.create).toHaveBeenCalled();
      expect(errorLoggingService.logError).toHaveBeenCalled();
      expect(httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        expect.any(Object),
        400
      );
    });

    it("should handle non-HTTP contexts gracefully", () => {
      const exception = new Error("Non-HTTP error");
      httpAdapterHost.httpAdapter = undefined;

      filter.catch(exception, mockHost);

      expect(filter["logger"].error).toHaveBeenCalledWith(
        "Exception in non-HTTP context",
        { exception }
      );
      expect(mockHost.switchToHttp).not.toHaveBeenCalled();
    });

    it("should use existing correlation ID from headers", () => {
      const exception = new Error("Test error");
      setupMockForLogging(mockErrorResponseBuilder);

      filter.catch(exception, mockHost);

      expect(mockRequest.correlationId).toBe("existing-correlation-123");
    });

    it("should use correlation ID from request property", () => {
      const exception = new Error("Test error");
      mockRequest.headers = {};
      (mockRequest as any).correlationId = "request-correlation-456";

      filter.catch(exception, mockHost);

      expect((mockRequest as any).correlationId).toBe(
        "request-correlation-456"
      );
    });

    it("should generate correlation ID when none exists", () => {
      const exception = new Error("Test error");
      setupMockForLogging(mockErrorResponseBuilder);
      
      // Create a request without correlation ID
      const requestWithoutId = createMockRequest({ headers: {} });
      delete (requestWithoutId as any).correlationId;
      
      const hostWithoutId = createMockArgumentsHost(requestWithoutId, mockResponse);

      filter.catch(exception, hostWithoutId);

      expect((requestWithoutId as any).correlationId).toBe("mock-uuid-1234");
    });

    it("should prioritize x-correlation-id header over request property", () => {
      const exception = new Error("Test error");
      (mockRequest as any).correlationId = "request-correlation";
      mockRequest.headers = {
        "x-correlation-id": "header-correlation",
      };

      filter.catch(exception, mockHost);

      expect((mockRequest as any).correlationId).toBe("header-correlation");
    });

    it("should create correct error context", () => {
      const exception = new Error("Test error");

      filter.catch(exception, mockHost);

      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        mockErrorMapping,
        expect.objectContaining({
          correlationId: "existing-correlation-123",
          timestamp: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
          ),
          path: "/api/address/search",
          method: "POST",
          userAgent: "Mozilla/5.0 (Test Browser)",
        })
      );
    });

    it("should handle missing request properties", () => {
      const exception = new Error("Test error");
      setupMockForLogging(mockErrorResponseBuilder);
      
      // Create a minimal request with missing properties
      const minimalRequest = { headers: {} };
      const minimalHost = createMockArgumentsHost(minimalRequest as any, mockResponse);

      filter.catch(exception, minimalHost);

      const createCall = (ErrorResponseBuilder.create as any).mock.calls[0][1];
      expect(createCall).toEqual(
        expect.objectContaining({
          correlationId: "mock-uuid-1234",
          path: "unknown",
          method: undefined,
          userAgent: undefined,
        })
      );
    });

    it("should log errors using error logging service", () => {
      const exception = new Error("Test error");

      filter.catch(exception, mockHost);

      expect(errorLoggingService.logError).toHaveBeenCalledWith(
        exception,
        expect.objectContaining({
          correlationId: "existing-correlation-123",
          timestamp: expect.any(String),
          path: "/api/address/search",
          method: "POST",
          userAgent: "Mozilla/5.0 (Test Browser)",
        }),
        expect.any(Object)
      );
    });

    it("should log warnings when log level is warn", () => {
      const exception = new Error("Warning error");
      mockErrorResponseBuilder.getLogLevel.mockReturnValue("warn");

      filter.catch(exception, mockHost);

      expect(errorLoggingService.logWarning).toHaveBeenCalledWith(
        "Warning error",
        expect.any(Object),
        expect.any(Object)
      );
      expect(errorLoggingService.logError).not.toHaveBeenCalled();
    });

    it("should not log when shouldLog returns false", () => {
      const exception = new Error("No log error");
      mockErrorResponseBuilder.shouldLog.mockReturnValue(false);

      filter.catch(exception, mockHost);

      expect(errorLoggingService.logError).not.toHaveBeenCalled();
      expect(errorLoggingService.logWarning).not.toHaveBeenCalled();
    });

    it("should handle different HTTP status codes", () => {
      const exception = new Error("Server error");
      setupMockForLogging(mockErrorResponseBuilder);
      mockErrorResponseBuilder.getHttpStatus.mockReturnValue(500);

      filter.catch(exception, mockHost);

      expect(httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        expect.any(Object),
        500
      );
    });

    it("should handle provider authentication errors", () => {
      const exception = createException.providerAuth(
        "TomTom",
        "Invalid API key"
      );
      setupMockForLogging(mockErrorResponseBuilder);

      filter.catch(exception, mockHost);

      expect(createErrorFromException).toHaveBeenCalledWith(exception);
      expect(errorLoggingService.logError).toHaveBeenCalledWith(
        exception,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it("should handle HTTP exceptions", () => {
      const exception = new HttpException(
        "Bad request",
        HttpStatus.BAD_REQUEST
      );
      mockErrorResponseBuilder.shouldLog.mockReturnValue(true);
      mockErrorResponseBuilder.getLogLevel.mockReturnValue("error");

      filter.catch(exception, mockHost);

      expect(createErrorFromException).toHaveBeenCalledWith(exception);
      expect(errorLoggingService.logError).toHaveBeenCalledWith(
        exception,
        expect.any(Object),
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
        })
      );
    });
  });

  describe("createErrorContext", () => {
    it("should create complete error context", () => {
      const request = createMockRequest({
        url: "/api/test",
        method: "GET",
        headers: { "user-agent": "Test Agent" },
      });
      const correlationId = "test-correlation";

      const context = filter["createErrorContext"](
        request as any,
        correlationId
      );

      expect(context).toEqual({
        correlationId: "test-correlation",
        timestamp: expect.stringMatching(validationPatterns.isoDate),
        path: "/api/test",
        method: "GET",
        userAgent: "Test Agent",
      });
    });

    it("should handle missing request properties", () => {
      const request = {} as Request;
      const correlationId = "test-correlation";

      const context = filter["createErrorContext"](request, correlationId);

      expect(context).toEqual({
        correlationId: "test-correlation",
        timestamp: expect.any(String),
        path: "unknown",
        method: undefined,
        userAgent: undefined,
      });
    });
  });

  describe("logError", () => {
    it("should extract additional data and log error", () => {
      const exception = new Error("Test error");
      const context: ErrorContext = {
        correlationId: "test-123",
        timestamp: "2023-01-01T00:00:00.000Z",
        path: "/test",
        method: "POST",
        userAgent: "Test Agent",
      };
      mockErrorResponseBuilder.shouldLog.mockReturnValue(true);
      mockErrorResponseBuilder.getLogLevel.mockReturnValue("error");

      filter["logError"](exception, context, mockErrorResponseBuilder);

      expect(errorLoggingService.logError).toHaveBeenCalledWith(
        exception,
        context,
        expect.any(Object)
      );
    });

    it("should log warning for warn level", () => {
      const exception = new Error("Warning error");
      const context: ErrorContext = {
        correlationId: "test-123",
        timestamp: "2023-01-01T00:00:00.000Z",
        path: "/test",
      };
      mockErrorResponseBuilder.shouldLog.mockReturnValue(true);
      mockErrorResponseBuilder.getLogLevel.mockReturnValue("warn");

      filter["logError"](exception, context, mockErrorResponseBuilder);

      expect(errorLoggingService.logWarning).toHaveBeenCalledWith(
        "Warning error",
        context,
        expect.any(Object)
      );
    });

    it("should not log when shouldLog is false", () => {
      const exception = new Error("No log error");
      const context: ErrorContext = {
        correlationId: "test-123",
        timestamp: "2023-01-01T00:00:00.000Z",
        path: "/test",
      };
      mockErrorResponseBuilder.shouldLog.mockReturnValue(false);

      filter["logError"](exception, context, mockErrorResponseBuilder);

      expect(errorLoggingService.logError).not.toHaveBeenCalled();
      expect(errorLoggingService.logWarning).not.toHaveBeenCalled();
    });
  });

  describe("extractAdditionalLoggingData", () => {
    it("should extract HTTP exception data", () => {
      const exception = new HttpException(
        { message: "Validation failed", errors: ["Field required"] },
        HttpStatus.BAD_REQUEST
      );

      const data = filter["extractAdditionalLoggingData"](exception);

      expect(data).toEqual({
        statusCode: HttpStatus.BAD_REQUEST,
        httpExceptionResponse: {
          message: "Validation failed",
          errors: ["Field required"],
        },
      });
    });

    it("should extract HTTP exception with string response", () => {
      const exception = new HttpException(
        "Simple error",
        HttpStatus.INTERNAL_SERVER_ERROR
      );

      const data = filter["extractAdditionalLoggingData"](exception);

      expect(data).toEqual({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it("should extract common error properties", () => {
      const exception = {
        message: "Custom error",
        code: "ERR001",
        type: "VALIDATION_ERROR",
        category: "INPUT",
        severity: "HIGH",
        source: "API",
        custom: "ignored",
      };

      const data = filter["extractAdditionalLoggingData"](exception);

      expect(data).toEqual({
        code: "ERR001",
        type: "VALIDATION_ERROR",
        category: "INPUT",
        severity: "HIGH",
        source: "API",
      });
    });

    it("should handle objects without common properties", () => {
      const exception = {
        message: "Error without common props",
        random: "value",
      };

      const data = filter["extractAdditionalLoggingData"](exception);

      expect(data).toEqual({});
    });

    it("should handle null/undefined exceptions", () => {
      expect(filter["extractAdditionalLoggingData"](null)).toEqual({});
      expect(filter["extractAdditionalLoggingData"](undefined)).toEqual({});
    });

    it("should handle primitive exceptions", () => {
      expect(filter["extractAdditionalLoggingData"]("string error")).toEqual(
        {}
      );
      expect(filter["extractAdditionalLoggingData"](123)).toEqual({});
      expect(filter["extractAdditionalLoggingData"](true)).toEqual({});
    });

    it("should handle provider exceptions", () => {
      const exception = new ProviderServiceError(
        "TomTom",
        "Service unavailable"
      );

      const data = filter["extractAdditionalLoggingData"](exception);

      expect(data).toEqual(
        expect.objectContaining({
          statusCode: expect.any(Number),
        })
      );
    });
  });

  describe("ensureError", () => {
    it("should return Error instances as-is", () => {
      const error = new Error("Test error");
      const result = filter["ensureError"](error);

      expect(result).toBe(error);
      expect(result.message).toBe("Test error");
    });

    it("should convert string to Error", () => {
      const result = filter["ensureError"]("String error");

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("String error");
    });

    it("should convert object with message to Error", () => {
      const exception = { message: "Object error", code: "ERR001" };
      const result = filter["ensureError"](exception);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("Object error");
    });

    it("should convert object without message to Error", () => {
      const exception = { code: "ERR001", data: "some data" };
      const result = filter["ensureError"](exception);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("Unknown error");
    });

    it("should handle null/undefined", () => {
      const nullResult = filter["ensureError"](null);
      const undefinedResult = filter["ensureError"](undefined);

      expect(nullResult).toBeInstanceOf(Error);
      expect(nullResult.message).toBe("Unknown error occurred");
      expect(undefinedResult).toBeInstanceOf(Error);
      expect(undefinedResult.message).toBe("Unknown error occurred");
    });

    it("should handle primitives", () => {
      const numberResult = filter["ensureError"](404);
      const booleanResult = filter["ensureError"](false);

      expect(numberResult).toBeInstanceOf(Error);
      expect(numberResult.message).toBe("Unknown error occurred");
      expect(booleanResult).toBeInstanceOf(Error);
      expect(booleanResult.message).toBe("Unknown error occurred");
    });

    it("should handle Error subclasses", () => {
      const typeError = new TypeError("Type error");
      const syntaxError = new SyntaxError("Syntax error");

      expect(filter["ensureError"](typeError)).toBe(typeError);
      expect(filter["ensureError"](syntaxError)).toBe(syntaxError);
    });

    it("should handle custom error classes", () => {
      const customError = new CountryMismatchException(
        "Australia",
        "USA",
        "123 Main St"
      );
      const result = filter["ensureError"](customError);

      expect(result).toBe(customError);
      expect(result).toBeInstanceOf(Error);
      expect(result).toBeInstanceOf(CountryMismatchException);
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete flow with provider exception", () => {
      const exception = new ProviderAuthenticationError(
        "TomTom",
        "Invalid API key"
      );
      mockErrorResponseBuilder.shouldLog.mockReturnValue(true);
      mockErrorResponseBuilder.getLogLevel.mockReturnValue("error");
      mockErrorResponseBuilder.getHttpStatus.mockReturnValue(401);

      filter.catch(exception, mockHost);

      // Verify correlation ID handling
      expect((mockRequest as any).correlationId).toBe(
        "existing-correlation-123"
      );

      // Verify error mapping
      expect(createErrorFromException).toHaveBeenCalledWith(exception);

      // Verify error response building
      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        mockErrorMapping,
        expect.objectContaining({
          correlationId: "existing-correlation-123",
        })
      );

      // Verify logging
      expect(errorLoggingService.logError).toHaveBeenCalledWith(
        exception,
        expect.any(Object),
        expect.objectContaining({
          statusCode: HttpStatus.UNAUTHORIZED,
        })
      );

      // Verify response
      expect(httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        mockErrorResponseBuilder.build(),
        401
      );
    });

    it("should handle minimal request with generated correlation ID", () => {
      const exception = new Error("Minimal error");
      setupMockForLogging(mockErrorResponseBuilder);
      
      // Create a minimal request
      const minimalRequest = {} as any;
      const minimalHost = createMockArgumentsHost(minimalRequest, mockResponse);

      filter.catch(exception, minimalHost);

      expect(minimalRequest.correlationId).toBe("mock-uuid-1234");
      expect(ErrorResponseBuilder.create).toHaveBeenCalledWith(
        mockErrorMapping,
        expect.objectContaining({
          correlationId: "mock-uuid-1234",
          path: "unknown",
          method: undefined,
          userAgent: undefined,
        })
      );
    });

    it("should handle complex HTTP exception with object response", () => {
      const responseData = {
        message: "Validation failed",
        statusCode: 422,
        error: "Unprocessable Entity",
        details: {
          field1: ["Field is required"],
          field2: ["Invalid format"],
        },
      };
      const exception = new HttpException(
        responseData,
        HttpStatus.UNPROCESSABLE_ENTITY
      );
      mockErrorResponseBuilder.shouldLog.mockReturnValue(true);
      mockErrorResponseBuilder.getLogLevel.mockReturnValue("error");

      filter.catch(exception, mockHost);

      expect(errorLoggingService.logError).toHaveBeenCalledWith(
        exception,
        expect.any(Object),
        expect.objectContaining({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          httpExceptionResponse: responseData,
        })
      );
    });

    it("should preserve original request correlation ID", () => {
      const exception = new Error("Test error");
      mockRequest.headers = {};
      (mockRequest as any).correlationId = "original-correlation-999";

      filter.catch(exception, mockHost);

      expect((mockRequest as any).correlationId).toBe(
        "original-correlation-999"
      );
    });
  });
});
