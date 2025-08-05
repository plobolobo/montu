import { ISuggestion } from "./address.interface";

export interface IAddressProvider<TRaw = unknown> {
  getSuggestions(query: string, limit?: number): Promise<ISuggestion<TRaw>[]>;
}
