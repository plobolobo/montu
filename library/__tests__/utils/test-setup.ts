/**
 * Test setup utilities for common test patterns and configurations
 */
import { Test, TestingModule } from "@nestjs/testing";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/common";
import { vi } from "vitest";
import {
  createMockHttpService,
  createMockConfigService,
  createMockLogger,
} from "./test-factories";

/**
 * Common mock setup for logging
 */
export const setupMockForLogging = (
  mockBuilder: any,
  shouldLog = true,
  level: "error" | "warn" | "debug" = "error"
) => {
  mockBuilder.shouldLog.mockReturnValue(shouldLog);
  mockBuilder.getLogLevel.mockReturnValue(level);
};

/**
 * Setup logger mocks to avoid console output during tests
 */
export const setupLoggerMocks = (service: any) => {
  const logger = service["logger"];
  if (logger) {
    vi.spyOn(logger, "error").mockImplementation(() => {});
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    vi.spyOn(logger, "debug").mockImplementation(() => {});
    vi.spyOn(logger, "log").mockImplementation(() => {});
    vi.spyOn(logger, "verbose").mockImplementation(() => {});
  }
};

/**
 * Create a testing module with common providers
 */
export const createTestingModuleWithCommonProviders = async (
  providers: any[] = [],
  configOverrides: Record<string, any> = {}
): Promise<{
  module: TestingModule;
  mockHttpService: ReturnType<typeof createMockHttpService>;
  mockConfigService: ReturnType<typeof createMockConfigService>;
}> => {
  const mockHttpService = createMockHttpService();
  const mockConfigService = createMockConfigService(configOverrides);

  const module = await Test.createTestingModule({
    providers: [
      ...providers,
      { provide: HttpService, useValue: mockHttpService },
      { provide: ConfigService, useValue: mockConfigService },
    ],
  }).compile();

  return {
    module,
    mockHttpService,
    mockConfigService,
  };
};

/**
 * Setup standard beforeEach for tests with HTTP and Config services
 */
export const createStandardBeforeEach = <T>(
  serviceClass: new (...args: any[]) => T,
  additionalProviders: any[] = [],
  configOverrides: Record<string, any> = {}
) => {
  return async () => {
    const { module, mockHttpService, mockConfigService } =
      await createTestingModuleWithCommonProviders(
        [serviceClass, ...additionalProviders],
        configOverrides
      );

    const service = module.get<T>(serviceClass);

    // Setup logger mocks if the service has a logger
    setupLoggerMocks(service);

    return {
      service,
      module,
      httpService: module.get(HttpService),
      configService: module.get(ConfigService),
      mockHttpService,
      mockConfigService,
    };
  };
};

/**
 * Standard afterEach cleanup
 */
export const standardAfterEach = () => {
  vi.clearAllMocks();
  vi.resetAllMocks();
};

/**
 * Assert that mocks have been called with specific patterns
 */
export const assertMockCall = {
  /**
   * Assert HTTP service was called with expected config
   */
  httpRequest: (mockHttpService: any, expectedConfig: any, callIndex = 0) => {
    expect(mockHttpService.request).toHaveBeenCalledWith(
      expect.objectContaining(expectedConfig)
    );
  },

  /**
   * Assert logger was called with expected message pattern
   */
  logger: (
    mockLogger: any,
    method: string,
    messagePattern: string | RegExp
  ) => {
    const calls = mockLogger[method].mock.calls;
    const found = calls.some((call: any[]) => {
      const message = call[0];
      if (typeof messagePattern === "string") {
        return message.includes(messagePattern);
      }
      return messagePattern.test(message);
    });
    expect(found).toBe(true);
  },

  /**
   * Assert error response builder was called with expected context
   */
  errorResponseBuilder: (mockBuilder: any, expectedContext: any) => {
    expect(mockBuilder.build).toHaveBeenCalledWith(
      expect.objectContaining(expectedContext)
    );
  },
};

/**
 * Common test patterns for error scenarios
 */
export const errorTestPatterns = {
  /**
   * Test that a provider error is properly mapped and thrown
   */
  testProviderErrorMapping: async (
    serviceMethod: () => Promise<any>,
    expectedErrorType: new (...args: any[]) => Error,
    expectedMessage?: string
  ) => {
    await expect(serviceMethod).rejects.toThrow(expectedErrorType);
    if (expectedMessage) {
      await expect(serviceMethod).rejects.toThrow(expectedMessage);
    }
  },

  /**
   * Test that HTTP errors are properly handled
   */
  testHttpErrorHandling: async (
    mockHttpService: any,
    httpError: any,
    serviceMethod: () => Promise<any>,
    expectedErrorType: new (...args: any[]) => Error
  ) => {
    mockHttpService.request.mockRejectedValue(httpError);
    await expect(serviceMethod).rejects.toThrow(expectedErrorType);
  },
};

/**
 * Common validation patterns
 */
export const validationPatterns = {
  /**
   * ISO date string pattern
   */
  isoDate: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,

  /**
   * UUID pattern
   */
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

  /**
   * Australian postcode pattern
   */
  australianPostcode: /^\d{4}$/,
};

/**
 * Mock data for different test scenarios
 */
export const testScenarios = {
  /**
   * Successful API response scenario
   */
  successResponse: {
    status: 200,
    data: {
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
  },

  /**
   * Empty results scenario
   */
  emptyResponse: {
    status: 200,
    data: { results: [] },
  },

  /**
   * Network error scenario
   */
  networkError: {
    code: "ENOTFOUND",
    message: "getaddrinfo ENOTFOUND api.example.com",
  },

  /**
   * Authentication error scenario
   */
  authError: {
    response: {
      status: 401,
      statusText: "Unauthorized",
      data: { message: "Invalid API key" },
    },
  },

  /**
   * Rate limit error scenario
   */
  rateLimitError: {
    response: {
      status: 429,
      statusText: "Too Many Requests",
      data: { message: "Rate limit exceeded" },
    },
  },

  /**
   * Service error scenario
   */
  serviceError: {
    response: {
      status: 503,
      statusText: "Service Unavailable",
      data: { message: "Service temporarily unavailable" },
    },
  },
};
