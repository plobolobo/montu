/**
 * Test data factories for consistent mock object creation across tests
 */
import { Request, Response } from "express";
import { ArgumentsHost, ExecutionContext, CallHandler } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { AxiosResponse, AxiosRequestConfig } from "axios";
import { Observable, of } from "rxjs";
import { vi } from "vitest";
import {
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderServiceError,
  ProviderNetworkError,
  ProviderUnknownError,
  CountryMismatchException,
  NoResultsException,
  InvalidInputException,
  ConfigurationException,
} from "../../src/exceptions";
import { ErrorContext, ErrorMapping } from "../../src/types";
import { ISuggestion, IAddress, ICoordinates } from "../../src/interfaces";

/**
 * HTTP Service Mock Factory
 */
export const createMockHttpService = () => ({
  request: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  axiosRef: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
});

/**
 * Config Service Mock Factory
 */
export const createMockConfigService = (
  overrides: Record<string, any> = {}
) => {
  const defaultConfig = {
    TOMTOM_BASE_URL: "https://api.tomtom.com",
    TOMTOM_VERSION: "2",
    TOMTOM_API_KEY: "test-api-key",
    TOMTOM_COUNTRY_SET: "AU",
    REQUEST_TIMEOUT: 5000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_BASE: 1000,
    ...overrides,
  };

  return {
    get: vi.fn().mockImplementation((key: string) => defaultConfig[key]),
  };
};

/**
 * Request Mock Factory
 */
export const createMockRequest = (
  overrides: Partial<Request> = {}
): Partial<Request> => ({
  url: "/api/address/search",
  method: "POST",
  headers: {
    "user-agent": "Mozilla/5.0 (Test Browser)",
    "content-type": "application/json",
  },
  query: { query: "123 Main St", limit: 10 },
  body: {},
  correlationId: "test-correlation-123",
  ...overrides,
});

/**
 * Response Mock Factory
 */
export const createMockResponse = (): Partial<Response> => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
});

/**
 * ArgumentsHost Mock Factory
 */
export const createMockArgumentsHost = (
  request?: Partial<Request>,
  response?: Partial<Response>
): ArgumentsHost => {
  const mockRequest = request || createMockRequest();
  const mockResponse = response || createMockResponse();

  return {
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue(mockRequest),
      getResponse: vi.fn().mockReturnValue(mockResponse),
    }),
    getArgs: vi.fn(),
    getArgByIndex: vi.fn(),
    switchToRpc: vi.fn(),
    switchToWs: vi.fn(),
    getType: vi.fn(),
  } as any;
};

/**
 * ExecutionContext Mock Factory
 */
export const createMockExecutionContext = (
  request?: Partial<Request>
): ExecutionContext => {
  const mockRequest = request || createMockRequest();

  return {
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue(mockRequest),
      getResponse: vi.fn().mockReturnValue(createMockResponse()),
    }),
    getClass: vi.fn(),
    getHandler: vi.fn(),
    getArgs: vi.fn(),
    getArgByIndex: vi.fn(),
    switchToRpc: vi.fn(),
    switchToWs: vi.fn(),
    getType: vi.fn(),
  } as any;
};

/**
 * CallHandler Mock Factory
 */
export const createMockCallHandler = <T = any>(data?: T): CallHandler => ({
  handle: vi.fn().mockReturnValue(of(data || { results: [] })),
});

/**
 * Axios Response Mock Factory
 */
export const createMockAxiosResponse = <T = any>(
  data?: T,
  overrides: Partial<AxiosResponse> = {}
): AxiosResponse<T> => ({
  data: data || {
    results: [
      {
        id: "test-id-1",
        address: {
          freeformAddress: "123 Test Street, Sydney NSW 2000, Australia",
          country: "Australia",
          municipality: "Sydney",
          position: { lat: -33.8688, lon: 151.2093 },
        },
        score: 0.95,
      },
    ],
  },
  status: 200,
  statusText: "OK",
  headers: {},
  config: {} as AxiosRequestConfig,
  ...overrides,
});

/**
 * Address Interface Mock Factory
 */
export const createMockAddress = (
  overrides: Partial<IAddress> = {}
): IAddress => ({
  fullAddress: "123 Test Street, Sydney NSW 2000, Australia",
  streetNumber: "123",
  streetName: "Test Street",
  suburb: "Sydney",
  municipality: "Sydney",
  state: "NSW",
  postcode: "2000",
  country: "Australia",
  coordinates: {
    lat: -33.8688,
    lon: 151.2093,
  },
  raw: {},
  ...overrides,
});

/**
 * Suggestion Interface Mock Factory
 */
export const createMockSuggestion = <TRaw = any>(
  overrides: Partial<ISuggestion<TRaw>> = {}
): ISuggestion<TRaw> => ({
  id: "test-suggestion-1",
  address: createMockAddress(overrides.address),
  score: 0.95,
  ...overrides,
});

/**
 * Error Context Mock Factory
 */
export const createMockErrorContext = (
  overrides: Partial<ErrorContext> = {}
): ErrorContext => ({
  timestamp: "2023-01-01T00:00:00.000Z",
  path: "/api/address/search",
  method: "POST",
  userAgent: "Mozilla/5.0 (Test Browser)",
  correlationId: "test-correlation-123",
  ...overrides,
});

/**
 * Error Mapping Mock Factory
 */
export const createMockErrorMapping = (
  overrides: Partial<ErrorMapping> = {}
): ErrorMapping => ({
  status: 400,
  message: "Test error message",
  details: { type: "TEST_ERROR" },
  ...overrides,
});

/**
 * Exception Factory - Creates specific exception types
 */
export const createException = {
  providerAuth: (provider = "TomTom", message = "Invalid API key") =>
    new ProviderAuthenticationError(provider, message),

  providerRateLimit: (provider = "TomTom", message = "Rate limit exceeded") =>
    new ProviderRateLimitError(provider, message),

  providerService: (provider = "TomTom", message = "Service unavailable") =>
    new ProviderServiceError(provider, message),

  providerNetwork: (provider = "TomTom", message = "Network error") =>
    new ProviderNetworkError(provider, message),

  providerUnknown: (provider = "TomTom", message = "Unknown error") =>
    new ProviderUnknownError(provider, message),

  countryMismatch: (
    expected = "Australia",
    actual = "USA",
    address = "123 Main St"
  ) => new CountryMismatchException(expected, actual, address),

  noResults: (query = "invalid address") => new NoResultsException(query),

  invalidInput: (message = "Invalid input") =>
    new InvalidInputException(message),

  configuration: (message = "Configuration error") =>
    new ConfigurationException(message),
};

/**
 * Logger Mock Factory
 */
export const createMockLogger = () => ({
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
  debug: vi.fn(),
  verbose: vi.fn(),
});

/**
 * Error Response Builder Mock Factory
 */
export const createMockErrorResponseBuilder = (overrides: any = {}) => ({
  build: vi.fn().mockReturnValue({
    success: false,
    error: {
      message: "Test error",
      statusCode: 400,
      timestamp: "2023-01-01T00:00:00.000Z",
      path: "/test",
      type: "TEST_ERROR",
    },
  }),
  getHttpStatus: vi.fn().mockReturnValue(400),
  shouldLog: vi.fn().mockReturnValue(true),
  getLogLevel: vi.fn().mockReturnValue("error"),
  ...overrides,
});

/**
 * Logging Config Mock Factory
 */
export const createMockLoggingConfig = (overrides: any = {}) => ({
  level: "error",
  format: "json",
  enableCorrelationId: true,
  enableMetrics: true,
  sensitiveFields: ["apiKey", "password", "token"],
  enableStackTrace: true,
  maxStackDepth: 10,
  ...overrides,
});

/**
 * HTTP Adapter Mock Factory
 */
export const createMockHttpAdapter = () => ({
  reply: vi.fn(),
});

/**
 * HTTP Adapter Host Mock Factory
 */
export const createMockHttpAdapterHost = (httpAdapter?: any) => ({
  httpAdapter: httpAdapter || createMockHttpAdapter(),
});
