export interface TomTomSearchResult {
  type: string;
  id: string;
  score: number;
  address: TomTomAddress;
  position: TomTomPosition;
  viewport?: TomTomViewport;
  entryPoints?: TomTomEntryPoint[];
  addressRanges?: TomTomAddressRange;
}

export interface TomTomAddress {
  streetNumber?: string;
  streetName?: string;
  municipalitySubdivision?: string;
  municipality?: string;
  countrySecondarySubdivision?: string;
  countrySubdivision?: string;
  countrySubdivisionName?: string;
  countrySubdivisionCode?: string;
  postalCode?: string;
  countryCode?: string;
  country?: string;
  countryCodeISO3?: string;
  freeformAddress?: string;
  localName?: string;
}

export interface TomTomPosition {
  lat: number;
  lon: number;
}

export interface TomTomViewport {
  topLeftPoint: { lat: number; lon: number };
  btmRightPoint: { lat: number; lon: number };
}

export interface TomTomEntryPoint {
  type: string;
  position: { lat: number; lon: number };
}

export interface TomTomAddressRange {
  rangeLeft: string;
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
}

export interface TomTomSearchResponse {
  summary: {
    query: string;
    queryType: string;
    queryTime: number;
    numResults: number;
    totalResults: number;
    fuzzyLevel: number;
  };
  results: TomTomSearchResult[];
}
