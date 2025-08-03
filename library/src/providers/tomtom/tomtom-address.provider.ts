import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";

import {
  IAddressProvider,
  ISuggestion,
  IAddress,
  ICoordinates,
} from "../../interfaces";
import { BaseHttpService } from "../../services/base-http.service";

import {
  ProviderServiceError,
  NoResultsException,
  CountryMismatchException,
} from "../../exceptions";
import { ConfigKey } from "../../config";
import { AUSTRALIA, PROVIDER_NAMES } from "../../constants";
import {
  TomTomSearchResult,
  TomTomSearchResponse,
  TomTomAddress,
} from "./tomtom.types";

@Injectable()
export class TomTomAddressProvider
  extends BaseHttpService
  implements IAddressProvider<TomTomSearchResult>
{
  protected readonly logger = new Logger(TomTomAddressProvider.name);

  constructor(httpService: HttpService, configService: ConfigService) {
    super(httpService, configService, {
      baseURL: configService.get(
        ConfigKey.TOMTOM_BASE_URL,
        "https://api.tomtom.com"
      ),
      timeout: configService.get(ConfigKey.REQUEST_TIMEOUT, 30000),
      retries: configService.get(ConfigKey.RETRY_ATTEMPTS, 3),
      retryDelay: configService.get(ConfigKey.RETRY_DELAY_BASE, 1000),
      provider: PROVIDER_NAMES.TOMTOM,
    });
  }

  async getSuggestions(
    query: string,
    limit = 10
  ): Promise<ISuggestion<TomTomSearchResult>[]> {
    const trimmedQuery = query.trim();

    this.logger.log("Fetching address suggestions from TomTom", {
      query: trimmedQuery,
      limit,
      provider: PROVIDER_NAMES.TOMTOM,
    });

    try {
      const response = await this.makeApiRequest(trimmedQuery, limit);
      const { data } = response;

      if ("detailedError" in data || "errorText" in data) {
        const errorData = data as any;
        const errorCode = errorData.detailedError?.code || "Unknown";
        const errorMessage =
          errorData.detailedError?.message ||
          errorData.errorText ||
          "Unknown TomTom error";
        throw new ProviderServiceError(
          PROVIDER_NAMES.TOMTOM,
          `TomTom API Error [${errorCode}]: ${errorMessage}`
        );
      }

      const { results } = data;

      if (!results || results.length === 0) {
        throw new NoResultsException(trimmedQuery, PROVIDER_NAMES.TOMTOM);
      }

      const australianResults = results.filter((result: TomTomSearchResult) =>
        this.isAustralianAddress(result.address)
      );

      if (australianResults.length === 0) {
        const nonAustralianCountries = results
          .map((r) => r.address.country || "Unknown")
          .filter((country, index, arr) => arr.indexOf(country) === index)
          .join(", ");

        throw new CountryMismatchException(
          AUSTRALIA.COUNTRY_NAME,
          nonAustralianCountries,
          trimmedQuery
        );
      }

      const suggestions = australianResults.map((result: TomTomSearchResult) =>
        this.mapToSuggestion(result)
      );

      this.logger.log("Successfully fetched TomTom suggestions", {
        resultCount: suggestions.length,
        query: trimmedQuery,
        provider: PROVIDER_NAMES.TOMTOM,
      });

      return suggestions;
    } catch (error: unknown) {
      throw error;
    }
  }

  private async makeApiRequest(
    query: string,
    limit: number
  ): Promise<{ data: TomTomSearchResponse }> {
    const version = this.configService.get(ConfigKey.TOMTOM_VERSION, "2");
    const apiKey = this.configService.get(ConfigKey.TOMTOM_API_KEY);
    const countrySet = this.configService.get(
      ConfigKey.TOMTOM_COUNTRY_SET,
      AUSTRALIA.COUNTRY_CODE
    );

    const url = `/search/${version}/search/${encodeURIComponent(query)}.json`;

    this.logger.debug(`Making TomTom API request: ${url}`, {
      query,
      limit,
      countrySet,
    });

    return await this.makeRequest<TomTomSearchResponse>({
      method: "GET",
      url,
      params: {
        key: apiKey,
        countrySet,
        limit: Math.min(limit, 100),
        typeahead: true,
        view: "Unified",
      },
      headers: {
        "User-Agent": "QuickRoute Address Parser/1.0.0",
      },
    });
  }

  private isAustralianAddress(address: TomTomAddress): boolean {
    const { countryCode, countryCodeISO3, country } = address;

    return (
      countryCode === AUSTRALIA.COUNTRY_CODE ||
      countryCodeISO3 === AUSTRALIA.COUNTRY_CODE_ISO3 ||
      country === AUSTRALIA.COUNTRY_NAME ||
      country?.toLowerCase() === "australia"
    );
  }

  private mapToSuggestion(
    result: TomTomSearchResult
  ): ISuggestion<TomTomSearchResult> {
    const { id, address, score } = result;

    return {
      id: id || `tomtom-${Math.random().toString(36).substr(2, 9)}`,
      text: address.freeformAddress || this.buildAddressText(address),
      score: score || 1.0,
      address: this.mapTomTomResultToIAddress(result),
    };
  }

  private mapTomTomResultToIAddress(
    result: TomTomSearchResult
  ): IAddress<TomTomSearchResult> {
    const { position, address } = result;
    const { lat, lon } = position;

    const coordinates: ICoordinates = { lat, lon };

    const {
      streetNumber = "",
      streetName = "",
      municipalitySubdivision: suburb = "",
      municipality = "",
      countrySubdivisionCode,
      countrySubdivision,
      postalCode: postcode = "",
      country = AUSTRALIA.COUNTRY_NAME,
      freeformAddress,
    } = address;

    const state = countrySubdivisionCode || countrySubdivision || "";

    const fullAddress = freeformAddress || this.buildAddressText(address);

    return {
      fullAddress,
      streetNumber,
      streetName,
      suburb,
      municipality,
      state,
      postcode,
      country,
      coordinates,
      raw: result,
    };
  }

  private buildAddressText(address: TomTomAddress): string {
    const {
      streetNumber,
      streetName,
      municipalitySubdivision,
      municipality,
      countrySubdivisionCode,
      postalCode,
    } = address;

    const components = [
      streetNumber,
      streetName,
      municipalitySubdivision,
      municipality,
      countrySubdivisionCode,
      postalCode,
    ].filter(Boolean);

    return components.join(", ");
  }
}
