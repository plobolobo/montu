import { ISuggestion } from "./address.interface";

export interface IAddressProvider<TRaw = unknown> {
  /**
   * Get address suggestions for a partial address input
   * @param query Partial address string
   * @param limit Maximum number of suggestions to return
   * @returns Promise with array of address suggestions
   */
  getSuggestions(query: string, limit?: number): Promise<ISuggestion<TRaw>[]>;
}
