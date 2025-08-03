import { Test, TestingModule } from "@nestjs/testing";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/common";
import { vi } from "vitest";
import {
  createMockHttpService,
  createMockConfigService,
  createMockLogger,
} from "./test-factories";

export const setupMockForLogging = (
  mockBuilder: any,
  shouldLog = true,
  level: "error" | "warn" | "debug" = "error"
) => {
  mockBuilder.shouldLog.mockReturnValue(shouldLog);
  mockBuilder.getLogLevel.mockReturnValue(level);
};

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

export const standardAfterEach = () => {
  vi.clearAllMocks();
  vi.resetAllMocks();
};

export const assertMockCall = {
  httpRequest: (mockHttpService: any, expectedConfig: any, callIndex = 0) => {
    expect(mockHttpService.request).toHaveBeenCalledWith(
      expect.objectContaining(expectedConfig)
    );
  },

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

  errorResponseBuilder: (mockBuilder: any, expectedContext: any) => {
    expect(mockBuilder.build).toHaveBeenCalledWith(
      expect.objectContaining(expectedContext)
    );
  },
};

export const errorTestPatterns = {
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

export const validationPatterns = {
  isoDate: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,

  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

  australianPostcode: /^\d{4}$/,
};

export const testScenarios = {
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

  rateLimitError: {
    response: {
      status: 429,
      statusText: "Too Many Requests",
      data: { message: "Rate limit exceeded" },
    },
  },

  serviceError: {
    response: {
      status: 503,
      statusText: "Service Unavailable",
      data: { message: "Service temporarily unavailable" },
    },
  },
};
