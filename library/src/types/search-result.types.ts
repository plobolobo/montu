import { ISuggestion } from "../interfaces";
export interface SearchMetadata {
  query: string;
  limit: number;
  resultCount: number;
  warnings: string[];
}
export interface SearchResult {
  results: ISuggestion[];
  metadata: SearchMetadata;
}

export interface ExtendedSearchMetadata extends SearchMetadata {
  provider: string;
  processingTime: number;
  correlationId: string;
  totalAttempts?: number;
}

export interface ExtendedSearchResult {
  results: ISuggestion[];
  metadata: ExtendedSearchMetadata;
  success: boolean;
}
