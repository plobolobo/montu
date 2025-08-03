import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { QuickrouteAddressParserService } from "../../src/services/quickroute-address-parser.service";
import { TomTomAddressProvider } from "../../src/providers/tomtom/tomtom-address.provider";
import { ADDRESS_PROVIDER_TOKEN } from "../../src/constants";
import {
  ProviderServiceError,
  ProviderRateLimitError,
  ProviderAuthenticationError,
  ProviderNetworkError,
  NoResultsException,
} from "../../src/exceptions";
import { ISuggestion } from "../../src/interfaces";
import { of, throwError } from "rxjs";
import { AxiosResponse } from "axios";
import { vi, describe, it, expect, beforeEach } from "vitest";

describe("End-to-End Flow Tests", () => {
  let service: QuickrouteAddressParserService;
  let provider: TomTomAddressProvider;
  let httpService: any;
  let configService: any;

  const mockSuccessResponse: AxiosResponse = {
    data: {
      results: [
        {
          type: "Point Address",
          id: "AU/PAD/p0/19616899",
          score: 2.98,
          address: {
            streetNumber: "123",
            streetName: "George Street",
            municipality: "Sydney",
            countrySubdivision: "NSW",
            postalCode: "2000",
            country: "Australia",
            freeformAddress: "123 George Street, Sydney NSW 2000, Australia",
          },
          position: { lat: -33.8688, lon: 151.2093 },
        },
      ],
    },
    status: 200,
    statusText: "OK",
    headers: {},
    config: {} as any,
  };

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
        QuickrouteAddressParserService,
        TomTomAddressProvider,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: ADDRESS_PROVIDER_TOKEN,
          useClass: TomTomAddressProvider,
        },
      ],
    }).compile();

    service = module.get<QuickrouteAddressParserService>(
      QuickrouteAddressParserService
    );
    provider = module.get<TomTomAddressProvider>(TomTomAddressProvider);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);

    configService.get.mockImplementation((key: string) => {
      switch (key) {
        case "TOMTOM_BASE_URL":
          return "https://api.tomtom.com";
        case "TOMTOM_VERSION":
          return "2";
        case "TOMTOM_API_KEY":
          return "test-api-key";
        case "TOMTOM_COUNTRY_SET":
          return "AU";
        case "REQUEST_TIMEOUT":
          return 5000;
        case "RETRY_ATTEMPTS":
          return 3;
        case "RETRY_DELAY_BASE":
          return 1000;
        default:
          return undefined;
      }
    });
  });

  describe("Full Flow Validation: Service -> Provider -> Mocked TomTom API", () => {
    it("should complete full successful flow from service to mocked API", async () => {
      httpService.request.mockReturnValue(of(mockSuccessResponse));

      const result = await service.searchAddresses(
        "123 George Street Sydney",
        5
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].address.fullAddress).toBe(
        "123 George Street, Sydney NSW 2000, Australia"
      );
      expect(result.results[0].address.coordinates.lat).toBe(-33.8688);
      expect(result.results[0].address.coordinates.lon).toBe(151.2093);
      expect(result.metadata.warnings).toEqual([]);

      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: expect.stringContaining("/search/2/search/"),
          params: expect.objectContaining({
            key: "test-api-key",
            countrySet: "AU",
            limit: 5,
          }),
        })
      );
    });

    it("should handle no results gracefully through full flow", async () => {
      const emptyResponse: AxiosResponse = {
        ...mockSuccessResponse,
        data: { results: [] },
      };
      httpService.request.mockReturnValue(of(emptyResponse));

      await expect(
        service.searchAddresses("nonexistent address", 5)
      ).rejects.toThrow(NoResultsException);
    });
  });

  describe("Verify Resilience: Transient Failures -> Success", () => {
    it("should succeed after transient 429 rate limit error", async () => {
      const rateLimitError = {
        response: {
          status: 429,
          statusText: "Too Many Requests",
          data: { message: "Rate limit exceeded" },
        },
      };

      httpService.request.mockReturnValueOnce(throwError(() => rateLimitError));

      await expect(
        service.searchAddresses("123 George Street Sydney", 5)
      ).rejects.toThrow(ProviderRateLimitError);

      httpService.request.mockReturnValueOnce(of(mockSuccessResponse));

      const result = await service.searchAddresses(
        "123 George Street Sydney",
        5
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].address.fullAddress).toBe(
        "123 George Street, Sydney NSW 2000, Australia"
      );

      expect(httpService.request).toHaveBeenCalledTimes(2);
    });

    it("should succeed after transient 500 server error", async () => {
      const serverError = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: { message: "Server error" },
        },
      };

      httpService.request.mockReturnValueOnce(throwError(() => serverError));

      await expect(
        service.searchAddresses("123 George Street Sydney", 5)
      ).rejects.toThrow(ProviderServiceError);

      httpService.request.mockReturnValueOnce(of(mockSuccessResponse));

      const result = await service.searchAddresses(
        "123 George Street Sydney",
        5
      );

      expect(result.results).toHaveLength(1);
      expect(httpService.request).toHaveBeenCalledTimes(2);
    });

    it("should succeed after multiple transient failures", async () => {
      const networkError = { request: {}, message: "Network Error" };
      const serverError = {
        response: {
          status: 503,
          statusText: "Service Unavailable",
          data: { message: "Service temporarily unavailable" },
        },
      };

      httpService.request.mockReturnValueOnce(throwError(() => networkError));
      await expect(
        service.searchAddresses("123 George Street Sydney", 5)
      ).rejects.toThrow(ProviderNetworkError);

      httpService.request.mockReturnValueOnce(throwError(() => serverError));
      await expect(
        service.searchAddresses("123 George Street Sydney", 5)
      ).rejects.toThrow(ProviderServiceError);

      httpService.request.mockReturnValueOnce(of(mockSuccessResponse));
      const result = await service.searchAddresses(
        "123 George Street Sydney",
        5
      );

      expect(result.results).toHaveLength(1);
      expect(httpService.request).toHaveBeenCalledTimes(3);
    });
  });

  describe("Final Error States: Persistent Failures", () => {
    it("should throw ProviderAuthenticationError for persistent 401/403 errors", async () => {
      const authError = {
        response: {
          status: 403,
          statusText: "Forbidden",
          data: { message: "Invalid API key" },
        },
      };

      httpService.request.mockReturnValue(throwError(() => authError));

      await expect(
        service.searchAddresses("123 George Street Sydney", 5)
      ).rejects.toThrow(ProviderAuthenticationError);

      expect(httpService.request).toHaveBeenCalledTimes(1);
    });

    it("should throw ProviderRateLimitError after max retries for persistent 429", async () => {
      const rateLimitError = {
        response: {
          status: 429,
          statusText: "Too Many Requests",
          data: { message: "Rate limit exceeded" },
        },
      };

      httpService.request.mockReturnValue(throwError(() => rateLimitError));

      await expect(
        service.searchAddresses("123 George Street Sydney", 5)
      ).rejects.toThrow(ProviderRateLimitError);

      expect(httpService.request).toHaveBeenCalledTimes(1);
    });

    it("should throw ProviderServiceError after max retries for persistent 500", async () => {
      const serverError = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: { message: "Server error" },
        },
      };

      httpService.request.mockReturnValue(throwError(() => serverError));

      await expect(
        service.searchAddresses("123 George Street Sydney", 5)
      ).rejects.toThrow(ProviderServiceError);

      expect(httpService.request).toHaveBeenCalledTimes(1);
    });

    it("should handle mixed error scenarios correctly", async () => {
      const rateLimitError = {
        response: {
          status: 429,
          statusText: "Too Many Requests",
          data: { message: "Rate limit exceeded" },
        },
      };

      const serverError = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: { message: "Server error" },
        },
      };

      httpService.request.mockReturnValueOnce(throwError(() => rateLimitError));
      await expect(
        service.searchAddresses("123 George Street Sydney", 5)
      ).rejects.toThrow(ProviderRateLimitError);

      httpService.request.mockReturnValueOnce(throwError(() => serverError));
      await expect(
        service.searchAddresses("123 George Street Sydney", 5)
      ).rejects.toThrow(ProviderServiceError);

      expect(httpService.request).toHaveBeenCalledTimes(2);
    });
  });

  describe("Performance and Concurrency", () => {
    it("should handle concurrent requests efficiently", async () => {
      httpService.request.mockReturnValue(of(mockSuccessResponse));

      const promises = Array.from({ length: 5 }, (_, i) =>
        service.searchAddresses(`${i} George Street Sydney`, 5)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.results).toHaveLength(1);
        expect(result.results[0].address.fullAddress).toBe(
          "123 George Street, Sydney NSW 2000, Australia"
        );
      });

      expect(httpService.request).toHaveBeenCalledTimes(5);
    });

    it("should handle request timeouts appropriately", async () => {
      const timeoutError = {
        code: "ECONNABORTED",
        message: "timeout of 5000ms exceeded",
      };

      httpService.request.mockReturnValue(throwError(() => timeoutError));

      await expect(
        service.searchAddresses("123 George Street Sydney", 5)
      ).rejects.toThrow();
    });
  });
});
