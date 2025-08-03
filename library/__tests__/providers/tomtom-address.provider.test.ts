import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { TomTomAddressProvider } from "../../src/providers/tomtom/tomtom-address.provider";
import {
  ProviderServiceError,
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderNetworkError,
  NoResultsException,
  CountryMismatchException,
  InvalidInputException,
} from "../../src/exceptions";
import { of, throwError } from "rxjs";
import { AxiosResponse } from "axios";
import { vi } from "vitest";

describe("TomTomAddressProvider", () => {
  let provider: TomTomAddressProvider;
  let httpService: any;
  let configService: any;

  beforeEach(async () => {
    const mockHttpService = {
      get: vi.fn(),
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
        TomTomAddressProvider,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    provider = module.get<TomTomAddressProvider>(TomTomAddressProvider);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);

    // Setup default config values
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
        default:
          return undefined;
      }
    });
  });

  describe("getSuggestions", () => {
    it("should return suggestions for valid Australian addresses", async () => {
      const mockResponse: AxiosResponse = {
        data: {
          results: [
            {
              type: "Point Address",
              id: "AU/PAD/p0/19616899",
              score: 2.9876543209,
              address: {
                streetNumber: "123",
                streetName: "George Street",
                municipality: "Sydney",
                countrySubdivision: "NSW",
                postalCode: "2000",
                country: "Australia",
                freeformAddress:
                  "123 George Street, Sydney NSW 2000, Australia",
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

      httpService.request.mockReturnValue(of(mockResponse));

      const result = await provider.getSuggestions(
        "123 George Street Sydney",
        10
      );

      expect(result).toHaveLength(1);
      expect(result[0].address.fullAddress).toContain("123 George Street");
      expect(result[0].address.fullAddress).toContain("Sydney");
      expect(result[0].address.coordinates.lat).toBe(-33.8688);
      expect(result[0].address.coordinates.lon).toBe(151.2093);
    });

    it("should filter out non-Australian results", async () => {
      const mockResponse: AxiosResponse = {
        data: {
          results: [
            {
              type: "Point Address",
              id: "US/PAD/p0/12345",
              score: 2.9,
              address: {
                streetNumber: "123",
                streetName: "Main Street",
                municipality: "New York",
                countrySubdivision: "NY",
                postalCode: "10001",
                country: "United States",
                freeformAddress:
                  "123 Main Street, New York NY 10001, United States",
              },
              position: { lat: 40.7128, lon: -74.006 },
            },
          ],
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      await expect(
        provider.getSuggestions("123 Main Street", 10)
      ).rejects.toThrow(CountryMismatchException);
    });

    it("should throw NoResultsException when no results returned", async () => {
      const mockResponse: AxiosResponse = {
        data: { results: [] },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      await expect(
        provider.getSuggestions("nonexistent address", 10)
      ).rejects.toThrow(NoResultsException);
    });

    it("should handle TomTom API errors with detailedError", async () => {
      const mockResponse: AxiosResponse = {
        data: {
          detailedError: {
            code: "400",
            message: "Invalid query parameter",
          },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      await expect(
        provider.getSuggestions("invalid query", 10)
      ).rejects.toThrow(ProviderServiceError);
    });

    it("should handle HTTP 403 errors", async () => {
      const error = {
        response: {
          status: 403,
          statusText: "Forbidden",
          data: { message: "Invalid API key" },
        },
      };

      httpService.request.mockReturnValue(throwError(() => error));

      await expect(provider.getSuggestions("Sydney", 10)).rejects.toThrow(
        ProviderAuthenticationError
      );
    });

    it("should handle HTTP 429 rate limiting", async () => {
      const error = {
        response: {
          status: 429,
          statusText: "Too Many Requests",
          data: { message: "Rate limit exceeded" },
        },
      };

      httpService.request.mockReturnValue(throwError(() => error));

      await expect(provider.getSuggestions("Sydney", 10)).rejects.toThrow(
        ProviderRateLimitError
      );
    });

    it("should handle HTTP 500 server errors", async () => {
      const error = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: { message: "Server error" },
        },
      };

      httpService.request.mockReturnValue(throwError(() => error));

      await expect(provider.getSuggestions("Sydney", 10)).rejects.toThrow(
        ProviderServiceError
      );
    });

    it("should handle network errors", async () => {
      const error = {
        request: {},
        message: "Network Error",
      };

      httpService.request.mockReturnValue(throwError(() => error));

      await expect(provider.getSuggestions("Sydney", 10)).rejects.toThrow(
        ProviderNetworkError
      );
    });

    it("should log detailed information for requests", async () => {
      const mockResponse: AxiosResponse = {
        data: { results: [] },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      // Mock logger to verify logging
      const loggerSpy = vi.spyOn(provider["logger"], "debug");

      try {
        await provider.getSuggestions("test query", 5);
      } catch (error) {
        // Expected to throw NoResultsException
      }

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining("Making TomTom API request"),
        expect.objectContaining({
          query: "test query",
          limit: 5,
          countrySet: "AU",
        })
      );
    });
  });

  describe("mapToSuggestion", () => {
    it("should correctly map TomTom result to suggestion", () => {
      const tomtomResult = {
        type: "Point Address",
        id: "AU/PAD/p0/19616899",
        score: 2.9876543209,
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
      };

      // Access private method for testing
      const suggestion = provider["mapToSuggestion"](tomtomResult);

      expect(suggestion.id).toBe("AU/PAD/p0/19616899");
      expect(suggestion.address.fullAddress).toBe(
        "123 George Street, Sydney NSW 2000, Australia"
      );
      expect(suggestion.address.coordinates.lat).toBe(-33.8688);
      expect(suggestion.address.coordinates.lon).toBe(151.2093);
      expect(suggestion.score).toBe(2.9876543209);
      expect(suggestion.address.raw).toBe(tomtomResult);
    });
  });

  describe("isAustralianAddress", () => {
    it("should return true for Australian addresses", () => {
      const australianAddress = {
        country: "Australia",
        countryCode: "AU",
      };

      const result = provider["isAustralianAddress"](australianAddress);
      expect(result).toBe(true);
    });

    it("should return false for non-Australian addresses", () => {
      const nonAustralianAddress = {
        country: "United States",
        countryCode: "US",
      };

      const result = provider["isAustralianAddress"](nonAustralianAddress);
      expect(result).toBe(false);
    });

    it("should handle missing country information", () => {
      const addressWithoutCountry = {
        streetName: "Main Street",
      };

      const result = provider["isAustralianAddress"](addressWithoutCountry);
      expect(result).toBe(false);
    });
  });
});
