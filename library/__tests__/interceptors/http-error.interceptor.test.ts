import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable, throwError, of } from "rxjs";
import {
  HttpErrorInterceptor,
  HttpErrorInterceptorOptions,
} from "../../src/interceptors/http-error.interceptor";
import {
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderServiceError,
  ProviderNetworkError,
  ProviderUnknownError,
  ProviderException,
  InvalidInputException,
} from "../../src/exceptions";
import {
  createMockExecutionContext,
  createMockCallHandler,
  createMockRequest,
  createException,
  standardAfterEach,
  testScenarios,
  asyncAssertions,
} from "../utils";

describe("HttpErrorInterceptor", () => {
  let interceptor: HttpErrorInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: any;

  const defaultOptions: HttpErrorInterceptorOptions = {
    provider: "TestProvider",
    timeoutMs: 5000,
  };

  beforeEach(() => {
    // Create mock objects using factories
    mockRequest = createMockRequest({
      query: { query: "test query", limit: 10 },
      body: {},
    });
    mockExecutionContext = createMockExecutionContext(mockRequest);
    mockCallHandler = createMockCallHandler();

    interceptor = new HttpErrorInterceptor(defaultOptions);
  });

  afterEach(standardAfterEach);

  describe("constructor", () => {
    it("should create interceptor with default options", () => {
      const interceptor = new HttpErrorInterceptor({ provider: "Test" });
      expect(interceptor).toBeDefined();
    });

    it("should create interceptor with custom timeout", () => {
      const interceptor = new HttpErrorInterceptor({
        provider: "Test",
        timeoutMs: 10000,
      });
      expect(interceptor).toBeDefined();
    });
  });

  describe("intercept - successful requests", () => {
    it("should pass through successful requests", async () => {
      const successData = { results: [] };
      mockCallHandler.handle.mockReturnValue(of(successData));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      const data = await result.toPromise();
      expect(data).toEqual(successData);
    });
  });

  describe("intercept - HTTP errors", () => {
    it("should handle 400 Bad Request", async () => {
      const httpError = {
        response: {
          status: 400,
          statusText: "Bad Request",
          data: { message: "Invalid parameters" },
        },
      };
      mockCallHandler.handle.mockReturnValue(throwError(() => httpError));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      await asyncAssertions.toRejectWithError(
        result.toPromise(),
        InvalidInputException,
        "Invalid input: Invalid query parameters"
      );
    });

    it("should handle 401 Unauthorized", async () => {
      const httpError = testScenarios.authError;
      mockCallHandler.handle.mockReturnValue(throwError(() => httpError));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      await asyncAssertions.toRejectWithError(
        result.toPromise(),
        ProviderAuthenticationError,
        "TestProvider authentication failed"
      );
    });

    it("should handle 429 Rate Limit", async () => {
      const httpError = {
        response: {
          status: 429,
          statusText: "Too Many Requests",
          data: { message: "Rate limit exceeded" },
        },
      };
      mockCallHandler.handle.mockReturnValue(throwError(() => httpError));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).toBeInstanceOf(ProviderRateLimitError);
        expect(error.message).toBe("TestProvider rate limit exceeded");
        expect(error.provider).toBe("TestProvider");
      }
    });

    it("should handle 500 Internal Server Error", async () => {
      const httpError = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: { message: "Server error" },
        },
      };
      mockCallHandler.handle.mockReturnValue(throwError(() => httpError));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).toBeInstanceOf(ProviderServiceError);
        expect(error.message).toBe("TestProvider service unavailable");
        expect(error.provider).toBe("TestProvider");
      }
    });

    it("should handle unknown HTTP status codes", async () => {
      const httpError = {
        response: {
          status: 418,
          statusText: "I'm a teapot",
          data: { message: "Unusual error" },
        },
      };
      mockCallHandler.handle.mockReturnValue(throwError(() => httpError));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).toBeInstanceOf(ProviderException);
        expect(error.message).toContain("Request failed with status 418");
      }
    });
  });

  describe("intercept - network errors", () => {
    it("should handle network errors (no response)", async () => {
      const networkError = {
        request: {},
        message: "Network Error",
      };
      mockCallHandler.handle.mockReturnValue(throwError(() => networkError));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).toBeInstanceOf(ProviderNetworkError);
        expect(error.message).toBe("Failed to connect to TestProvider");
        expect(error.provider).toBe("TestProvider");
      }
    });
  });

  describe("intercept - unknown errors", () => {
    it("should handle unknown error objects", async () => {
      const unknownError = new Error("Something went wrong");
      mockCallHandler.handle.mockReturnValue(throwError(() => unknownError));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).toBeInstanceOf(ProviderUnknownError);
        expect(error.message).toBe("TestProvider unexpected error");
        expect(error.provider).toBe("TestProvider");
      }
    });

    it("should handle non-Error unknown values", async () => {
      const unknownError = "String error";
      mockCallHandler.handle.mockReturnValue(throwError(() => unknownError));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).toBeInstanceOf(ProviderUnknownError);
        expect(error.message).toBe("TestProvider unexpected error");
      }
    });
  });

  describe("intercept - exception rethrow behavior", () => {
    it("should rethrow existing provider exceptions", async () => {
      const existingException = new ProviderAuthenticationError(
        "ExistingProvider",
        "Test auth error"
      );
      mockCallHandler.handle.mockReturnValue(
        throwError(() => existingException)
      );

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).toBe(existingException); // Should be the exact same instance
        expect(error).toBeInstanceOf(ProviderAuthenticationError);
      }
    });

    it("should rethrow InvalidInputException", async () => {
      const invalidInputException = new InvalidInputException(
        "Test invalid input"
      );
      mockCallHandler.handle.mockReturnValue(
        throwError(() => invalidInputException)
      );

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).toBe(invalidInputException);
        expect(error).toBeInstanceOf(InvalidInputException);
      }
    });
  });

  describe("error context creation", () => {
    it("should create context from request query", async () => {
      mockRequest.query = { query: "Sydney", limit: 5 };
      mockRequest.body = {};

      const httpError = {
        response: { status: 500 },
      };
      mockCallHandler.handle.mockReturnValue(throwError(() => httpError));

      const loggerSpy = vi.spyOn(interceptor["logger"], "error");

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch {
        // Check that logger was called with correct context
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining("TestProvider API HTTP error"),
          expect.objectContaining({
            provider: "TestProvider",
            query: "Sydney",
            limit: 5,
          })
        );
      }
    });

    it("should create context from request body when query not available", async () => {
      mockRequest.query = {};
      mockRequest.body = { query: "Melbourne", limit: 15 };

      const httpError = {
        response: { status: 500 },
      };
      mockCallHandler.handle.mockReturnValue(throwError(() => httpError));

      const loggerSpy = vi.spyOn(interceptor["logger"], "error");

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch {
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining("TestProvider API HTTP error"),
          expect.objectContaining({
            provider: "TestProvider",
            query: "Melbourne",
            limit: 15,
          })
        );
      }
    });

    it("should use default values when query/limit not available", async () => {
      mockRequest.query = {};
      mockRequest.body = {};

      const httpError = {
        response: { status: 500 },
      };
      mockCallHandler.handle.mockReturnValue(throwError(() => httpError));

      const loggerSpy = vi.spyOn(interceptor["logger"], "error");

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch {
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining("TestProvider API HTTP error"),
          expect.objectContaining({
            provider: "TestProvider",
            query: "unknown",
            limit: 10,
          })
        );
      }
    });
  });

  describe("custom error mapper", () => {
    it("should use custom error mapper when provided", async () => {
      const customMapper = {
        mapHttpError: vi
          .fn()
          .mockReturnValue(
            new ProviderUnknownError("Custom", "Custom HTTP error")
          ),
        mapNetworkError: vi.fn(),
        mapUnknownError: vi.fn(),
        shouldRethrowException: vi.fn().mockReturnValue(false),
      };

      const customInterceptor = new HttpErrorInterceptor({
        provider: "CustomProvider",
        errorMapper: customMapper,
      });

      const httpError = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: { message: "Server error" },
        },
      };
      mockCallHandler.handle.mockReturnValue(throwError(() => httpError));

      const result = customInterceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(customMapper.mapHttpError).toHaveBeenCalledWith(
          500,
          "CustomProvider",
          { message: "Server error" }
        );
        expect(error).toBeInstanceOf(ProviderUnknownError);
        expect(error.message).toBe("Custom unexpected error");
      }
    });

    it("should use custom shouldRethrowException logic", async () => {
      const customError = new Error("Custom error to rethrow");

      const customMapper = {
        mapHttpError: vi.fn(),
        mapNetworkError: vi.fn(),
        mapUnknownError: vi.fn(),
        shouldRethrowException: vi.fn().mockReturnValue(true),
      };

      const customInterceptor = new HttpErrorInterceptor({
        provider: "CustomProvider",
        errorMapper: customMapper,
      });

      mockCallHandler.handle.mockReturnValue(throwError(() => customError));

      const result = customInterceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(customMapper.shouldRethrowException).toHaveBeenCalledWith(
          customError
        );
        expect(error).toBe(customError); // Should be the exact same instance
      }
    });
  });

  describe("logging behavior", () => {
    it("should log HTTP errors with context", async () => {
      const loggerSpy = vi.spyOn(interceptor["logger"], "error");

      const httpError = {
        response: {
          status: 404,
          statusText: "Not Found",
          data: { message: "Resource not found" },
        },
      };
      mockCallHandler.handle.mockReturnValue(throwError(() => httpError));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch {
        expect(loggerSpy).toHaveBeenCalledWith(
          "TestProvider API HTTP error",
          expect.objectContaining({
            provider: "TestProvider",
            query: "test query",
            limit: 10,
            status: 404,
            statusText: "Not Found",
            errorData: { message: "Resource not found" },
          })
        );
      }
    });

    it("should log final mapped exception", async () => {
      const loggerSpy = vi.spyOn(interceptor["logger"], "error");

      const httpError = {
        response: { status: 429 },
      };
      mockCallHandler.handle.mockReturnValue(throwError(() => httpError));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler
      );

      try {
        await result.toPromise();
        expect.fail("Should have thrown an error");
      } catch {
        expect(loggerSpy).toHaveBeenCalledWith(
          "TestProvider API error intercepted: TestProvider rate limit exceeded",
          expect.objectContaining({
            error: "TestProvider rate limit exceeded",
            context: {
              provider: "TestProvider",
              query: "test query",
              limit: 10,
            },
            errorType: "ProviderRateLimitError",
          })
        );
      }
    });
  });
});
