import { Injectable, Inject, Logger } from "@nestjs/common";
import { IAddressProvider } from "../interfaces";
import { ADDRESS_PROVIDER_TOKEN } from "../constants";
import { getValidatedDataOrThrow } from "../utils";
import { SearchResult } from "../types/search-result.types";

@Injectable()
export class QuickrouteAddressParserService {
  private readonly logger = new Logger(QuickrouteAddressParserService.name);

  constructor(
    @Inject(ADDRESS_PROVIDER_TOKEN)
    private readonly addressProvider: IAddressProvider
  ) {}

  async searchAddresses(query: string, limit = 10): Promise<SearchResult> {
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
}
