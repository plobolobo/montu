import { ISuggestion } from "../interfaces";
import {
  AddressResponseDto,
  SearchResponseDto,
  AddressResponseSchema,
  SearchResponseSchema,
} from "../dto";

/**
 * Transform suggestion to DTO
 */
export const transformSuggestionToDto = <TRaw = unknown>(
  suggestion: ISuggestion<TRaw>
): AddressResponseDto => {
  const { id, score, address } = suggestion;
  const {
    fullAddress,
    streetNumber,
    streetName,
    suburb,
    municipality,
    state,
    postcode,
    country,
    coordinates,
  } = address;

  const dto = {
    id,
    fullAddress,
    streetNumber,
    streetName,
    suburb,
    municipality,
    state,
    postcode,
    country,
    coordinates,
    confidence: score,
  };

  return AddressResponseSchema.parse(dto);
};

/**
 * Transform multiple suggestions to DTOs
 */
export const transformSuggestionsToDto = <TRaw = unknown>(
  suggestions: ISuggestion<TRaw>[]
): AddressResponseDto[] => {
  return suggestions.map(transformSuggestionToDto);
};

/**
 * Create search response DTO
 */
export const createSearchResponseDto = (
  results: AddressResponseDto[],
  metadata: {
    query: string;
    limit: number;
    provider: string;
    processingTime: number;
    correlationId: string;
    warnings?: string[];
  }
): SearchResponseDto => {
  const response = {
    results,
    metadata: {
      ...metadata,
      resultCount: results.length,
      warnings: metadata.warnings || [],
    },
    success: true,
  };

  return SearchResponseSchema.parse(response);
};
