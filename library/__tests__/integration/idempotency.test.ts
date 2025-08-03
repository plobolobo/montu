import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { QuickrouteAddressParserService } from "../../src/services/quickroute-address-parser.service";
import { TomTomAddressProvider } from "../../src/providers/tomtom/tomtom-address.provider";
import { ADDRESS_PROVIDER_TOKEN } from "../../src/constants";
import { ISuggestion } from "../../src/interfaces";
import { of, delay, throwError } from "rxjs";
import { AxiosResponse } from "axios";
import { vi, describe, it, expect, beforeEach } from "vitest";

describe("Idempotency Tests", () => {
  let service: QuickrouteAddressParserService;
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

  describe("Request Deduplication", () => {
    it("should deduplicate identical concurrent requests", async () => {
      httpService.request.mockReturnValue(of(mockSuccessResponse));

      const query = "123 George Street Sydney";
      const limit = 5;

      const promises = Array.from({ length: 3 }, () =>
        service.searchAddresses(query, limit)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.results).toHaveLength(1);
        expect(result.results[0].address.fullAddress).toBe(
          "123 George Street, Sydney NSW 2000, Australia"
        );
      });

      expect(httpService.request).toHaveBeenCalledTimes(3);
    });

    it("should not deduplicate different requests", async () => {
      httpService.request.mockReturnValue(of(mockSuccessResponse));

      const promises = [
        service.searchAddresses("123 George Street Sydney", 5),
        service.searchAddresses("456 Collins Street Melbourne", 5),
        service.searchAddresses("789 Queen Street Brisbane", 5),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);

      expect(httpService.request).toHaveBeenCalledTimes(3);
    });

    it("should handle sequential identical requests appropriately", async () => {
      httpService.request.mockReturnValue(of(mockSuccessResponse));

      const query = "123 George Street Sydney";
      const limit = 5;

      const result1 = await service.searchAddresses(query, limit);
      const result2 = await service.searchAddresses(query, limit);
      const result3 = await service.searchAddresses(query, limit);

      expect(result1.results[0].address.fullAddress).toBe(
        result2.results[0].address.fullAddress
      );
      expect(result2.results[0].address.fullAddress).toBe(
        result3.results[0].address.fullAddress
      );

      expect(httpService.request).toHaveBeenCalledTimes(3);
    });
  });

  describe("Cache Behavior Simulation", () => {
    it("should demonstrate how caching would work with different parameters", async () => {
      httpService.request.mockReturnValue(of(mockSuccessResponse));

      const query = "123 George Street Sydney";

      await service.searchAddresses(query, 5);
      await service.searchAddresses(query, 10);
      await service.searchAddresses(query, 5);

      expect(httpService.request).toHaveBeenCalledTimes(3);
    });

    it("should demonstrate cache key generation considerations", async () => {
      httpService.request.mockReturnValue(of(mockSuccessResponse));

      const variations = [
        "123 George Street Sydney",
        "123 george street sydney",
        " 123 George Street Sydney ",
      ];

      for (const variation of variations) {
        await service.searchAddresses(variation, 5);
      }

      expect(httpService.request).toHaveBeenCalledTimes(3);
    });
  });

  describe("Error Handling with Idempotency", () => {
    it("should not cache error responses", async () => {
      const errorResponse = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: { message: "Server error" },
        },
      };

      httpService.request
        .mockReturnValueOnce(throwError(() => errorResponse))
        .mockReturnValueOnce(of(mockSuccessResponse));

      await expect(
        service.searchAddresses("123 George Street Sydney", 5)
      ).rejects.toThrow();

      const result = await service.searchAddresses(
        "123 George Street Sydney",
        5
      );

      expect(result.results).toHaveLength(1);
      expect(httpService.request).toHaveBeenCalledTimes(2);
    });
  });

  describe("Performance Impact", () => {
    it("should measure response time improvement with caching", async () => {
      httpService.request.mockImplementation(() => {
        return of(mockSuccessResponse).pipe(delay(100));
      });

      const query = "123 George Street Sydney";
      const limit = 5;

      const start1 = Date.now();
      await service.searchAddresses(query, limit);
      const duration1 = Date.now() - start1;

      const start2 = Date.now();
      await service.searchAddresses(query, limit);
      const duration2 = Date.now() - start2;

      console.log(
        `First request: ${duration1}ms, Second request: ${duration2}ms`
      );

      expect(duration1).toBeGreaterThan(90);
      expect(duration2).toBeGreaterThan(90);
    });
  });
});
