export {
  StandaloneConfig,
  AddressSearchResult,
  StandaloneLoggingConfig,
} from "./types/standalone.types";

export declare class QuickrouteAddressParser {
  constructor(config: StandaloneConfig);

  searchAddresses(query: string, limit?: number): Promise<AddressSearchResult>;

  getProviderName(): Promise<string>;

  close(): Promise<void>;
}

export * from "./interfaces";
export * from "./dto";
export * from "./types";

export default QuickrouteAddressParser;
