import { Injectable, Inject, Logger } from "@nestjs/common";
import { IAddressProvider, ISuggestion } from "../interfaces";
import { ADDRESS_PROVIDER_TOKEN, PROVIDER_NAMES } from "../constants";
import { getValidatedDataOrThrow } from "../utils";

@Injectable()
export class QuickrouteAddressParserService {
  private readonly logger = new Logger(QuickrouteAddressParserService.name);

  constructor(
    @Inject(ADDRESS_PROVIDER_TOKEN)
    private readonly addressProvider: IAddressProvider
  ) {}

  async searchAddresses(
    query: string,
    limit = 10
  ): Promise<{
    results: ISuggestion[];
    metadata: {
      query: string;
      limit: number;
      resultCount: number;
      warnings: string[];
    };
  }> {
    const { data: validatedData, warnings } = getValidatedDataOrThrow({
      query,
      limit,
    });

    this.logger.debug("Starting address search", {
      query: validatedData.query,
      limit: validatedData.limit,
    });

    const suggestions = await this.addressProvider.getSuggestions(
      validatedData.query,
      validatedData.limit
    );

    this.logger.debug("Address search completed", {
      query: validatedData.query,
      limit: validatedData.limit,
      resultCount: suggestions.length,
    });

    return {
      results: suggestions,
      metadata: {
        query: validatedData.query,
        limit: validatedData.limit,
        resultCount: suggestions.length,
        warnings: warnings ? [...warnings] : [],
      },
    };
  }

  getProviderName(): string {
    return PROVIDER_NAMES.TOMTOM;
  }
}
