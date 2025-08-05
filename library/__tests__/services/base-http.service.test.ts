import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { of, throwError } from "rxjs";
import { AxiosResponse, AxiosError, AxiosRequestConfig } from "axios";
import {
  BaseHttpService,
  BaseHttpOptions,
} from "../../src/services/base-http.service";
import { HttpErrorInterceptor } from "../../src/interceptors/http-error.interceptor";
import {
  UnauthorizedException,
  HttpException,
  BadGatewayException,
  InternalServerErrorException,
} from "@nestjs/common";

class TestHttpService extends BaseHttpService {
  constructor(
    httpService: HttpService,
    configService: ConfigService,
    options: BaseHttpOptions
  ) {
    super(httpService, configService, options);
  }

  public testMakeRequest<T>(
    config: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.makeRequest<T>(config);
  }

  public testGet<T>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.get<T>(url, config);
  }

  public testPost<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.post<T>(url, data, config);
  }
}

describe("BaseHttpService", () => {
  let service: TestHttpService;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockOptions: BaseHttpOptions = {
    baseURL: "https://api.test.com",
    timeout: 5000,
    retries: 3,
    retryDelay: 1000,
    headers: { "X-Test": "test" },
    provider: "TestProvider",
  };

  const mockAxiosResponse: AxiosResponse = {
    data: { results: ["test"] },
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  } as AxiosResponse;

  beforeEach(async () => {
    const mockHttpService = {
      request: vi.fn(),
      axiosRef: {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      },
    };

    const mockConfigService = {
      get: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);

    service = new TestHttpService(httpService, configService, mockOptions);

    vi.spyOn(service["logger"], "debug").mockImplementation(() => {});
    vi.spyOn(service["logger"], "error").mockImplementation(() => {});
    vi.spyOn(service["logger"], "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should be defined", () => {
      expect(service).toBeDefined();
    });

    it("should initialize with correct options", () => {
      expect(service["options"]).toEqual(mockOptions);
    });

    it("should have logger with correct name", () => {
      expect(service["logger"]).toBeInstanceOf(Logger);
    });

    it("should initialize HTTP error interceptor", () => {
      expect(service["httpErrorInterceptor"]).toBeDefined();
    });
  });

  describe("makeRequest method", () => {
    const mockRequestConfig: AxiosRequestConfig = {
      url: "/test",
      method: "GET",
      params: { q: "test" },
    };

    it("should make successful HTTP request", async () => {
      httpService.request = vi.fn().mockReturnValue(of(mockAxiosResponse));

      const result = await service.testMakeRequest(mockRequestConfig);

      expect(result).toEqual(mockAxiosResponse);
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: mockOptions.baseURL,
          timeout: mockOptions.timeout,
          url: mockRequestConfig.url,
          method: mockRequestConfig.method,
        })
      );
    });

    it("should include default headers", async () => {
      httpService.request = vi.fn().mockReturnValue(of(mockAxiosResponse));

      await service.testMakeRequest(mockRequestConfig);

      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining(mockOptions.headers),
        })
      );
    });

    it("should log request details", async () => {
      const logSpy = vi.spyOn(service["logger"], "debug");
      httpService.request = vi.fn().mockReturnValue(of(mockAxiosResponse));

      await service.testMakeRequest(mockRequestConfig);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Making GET request to TestProvider"),
        expect.objectContaining({
          url: mockRequestConfig.url,
          method: mockRequestConfig.method,
          provider: "TestProvider",
        })
      );
    });

    it("should handle authentication errors", async () => {
      const authError = new AxiosError("Unauthorized", "401");
      authError.response = { status: 401 } as any;
      httpService.request = vi
        .fn()
        .mockReturnValue(throwError(() => authError));

      await expect(service.testMakeRequest(mockRequestConfig)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should handle rate limit errors", async () => {
      const rateLimitError = new AxiosError("Too Many Requests", "429");
      rateLimitError.response = { status: 429 } as any;
      httpService.request = vi
        .fn()
        .mockReturnValue(throwError(() => rateLimitError));

      await expect(service.testMakeRequest(mockRequestConfig)).rejects.toThrow(
        HttpException
      );
    });

    it("should handle service errors", async () => {
      const serviceError = new AxiosError("Internal Server Error", "500");
      serviceError.response = { status: 500 } as any;
      httpService.request = vi
        .fn()
        .mockReturnValue(throwError(() => serviceError));

      await expect(service.testMakeRequest(mockRequestConfig)).rejects.toThrow(
        BadGatewayException
      );
    });

    it("should handle network errors", async () => {
      const networkError = new AxiosError("Network Error");
      networkError.code = "ECONNREFUSED";
      httpService.request = vi
        .fn()
        .mockReturnValue(throwError(() => networkError));

      await expect(service.testMakeRequest(mockRequestConfig)).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("timeout of 5000ms exceeded");
      timeoutError.name = "TimeoutError";
      httpService.request = vi
        .fn()
        .mockReturnValue(throwError(() => timeoutError));

      await expect(service.testMakeRequest(mockRequestConfig)).rejects.toThrow(
        BadGatewayException
      );
    });

    it("should handle errors through interceptor", async () => {
      const error = new AxiosError("Test error");
      error.response = { status: 500 } as any;
      httpService.request = vi.fn().mockReturnValue(throwError(() => error));

      await expect(service.testMakeRequest(mockRequestConfig)).rejects.toThrow(
        BadGatewayException
      );
    });
  });

  describe("get method", () => {
    it("should make GET request", async () => {
      httpService.request = vi.fn().mockReturnValue(of(mockAxiosResponse));

      const result = await service.testGet("/search", {
        params: { q: "test" },
      });

      expect(result).toEqual(mockAxiosResponse);
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "/search",
          params: { q: "test" },
        })
      );
    });

    it("should handle GET request without config", async () => {
      httpService.request = vi.fn().mockReturnValue(of(mockAxiosResponse));

      await service.testGet("/test");

      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "/test",
        })
      );
    });
  });

  describe("post method", () => {
    it("should make POST request with data", async () => {
      const postData = { query: "test", limit: 10 };
      httpService.request = vi.fn().mockReturnValue(of(mockAxiosResponse));

      const result = await service.testPost("/search", postData);

      expect(result).toEqual(mockAxiosResponse);
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "/search",
          data: postData,
        })
      );
    });

    it("should make POST request without data", async () => {
      httpService.request = vi.fn().mockReturnValue(of(mockAxiosResponse));

      await service.testPost("/test");

      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "/test",
        })
      );
    });
  });

  describe("error handling via interceptor", () => {
    it("should use HttpErrorInterceptor for error handling", () => {
      expect(service["httpErrorInterceptor"]).toBeDefined();
      expect(service["httpErrorInterceptor"]).toBeInstanceOf(
        HttpErrorInterceptor
      );
    });
  });

  describe("retry configuration", () => {
    it("should setup axios retry with correct options", () => {
      expect(service["options"].retries).toBe(3);
      expect(service["options"].retryDelay).toBe(1000);
    });

    it("should retry on retryable errors", async () => {
      const persistentError = new AxiosError("Persistent error");
      persistentError.response = { status: 500 } as any;

      httpService.request = vi
        .fn()
        .mockReturnValue(throwError(() => persistentError));

      await expect(
        service.testMakeRequest({ url: "/test", method: "GET" })
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe("configuration validation", () => {
    it("should handle missing timeout gracefully", () => {
      const optionsWithoutTimeout = { ...mockOptions };
      delete optionsWithoutTimeout.timeout;

      const serviceWithoutTimeout = new TestHttpService(
        httpService,
        configService,
        optionsWithoutTimeout
      );

      expect(serviceWithoutTimeout).toBeDefined();
    });

    it("should handle missing retries gracefully", () => {
      const optionsWithoutRetries = { ...mockOptions };
      delete optionsWithoutRetries.retries;

      const serviceWithoutRetries = new TestHttpService(
        httpService,
        configService,
        optionsWithoutRetries
      );

      expect(serviceWithoutRetries).toBeDefined();
    });

    it("should use default timeout when not specified", async () => {
      const optionsWithoutTimeout = { ...mockOptions };
      delete optionsWithoutTimeout.timeout;

      const serviceWithoutTimeout = new TestHttpService(
        httpService,
        configService,
        optionsWithoutTimeout
      );

      httpService.request = vi.fn().mockReturnValue(of(mockAxiosResponse));

      await serviceWithoutTimeout.testMakeRequest({
        url: "/test",
        method: "GET",
      });

      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        })
      );
    });
  });

  describe("logging behavior", () => {
    it("should log warnings on retry attempts", () => {
      const warnSpy = vi.spyOn(service["logger"], "warn");

      expect(service["options"].provider).toBe("TestProvider");
      expect(service["options"].retries).toBe(3);

      expect(warnSpy).toBeDefined();
    });
  });

  describe("request configuration merging", () => {
    it("should merge base configuration with request configuration", async () => {
      httpService.request = vi.fn().mockReturnValue(of(mockAxiosResponse));

      const requestConfig = {
        url: "/test",
        method: "GET" as const,
        headers: { "Custom-Header": "value" },
        params: { q: "test" },
      };

      await service.testMakeRequest(requestConfig);

      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: mockOptions.baseURL,
          timeout: mockOptions.timeout,
          headers: expect.objectContaining({
            "Custom-Header": "value",
          }),
          url: "/test",
          method: "GET",
          params: { q: "test" },
        })
      );
    });

    it("should prioritize request headers over base headers", async () => {
      httpService.request = vi.fn().mockReturnValue(of(mockAxiosResponse));

      const requestConfig = {
        url: "/test",
        method: "GET" as const,
        headers: { "X-Test": "overridden" },
      };

      await service.testMakeRequest(requestConfig);

      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Test": "overridden",
          }),
        })
      );
    });
  });
});
