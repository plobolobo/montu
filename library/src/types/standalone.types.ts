import { LoggingConfig } from "../config/logging.config";
import { SearchResult } from "./search-result.types";

export interface StandaloneConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  enableLogging?: boolean;
  loggingConfig?: StandaloneLoggingConfig;
}

export interface StandaloneLoggingConfig extends Partial<LoggingConfig> {
  enableRequestLogging?: boolean;
}

export type AddressSearchResult = SearchResult;
