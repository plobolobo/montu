export interface ICoordinates {
  lat: number;
  lon: number;
}

export interface IAddress<TRaw = unknown> {
  fullAddress: string;
  streetNumber?: string;
  streetName?: string;
  suburb?: string;
  municipality?: string;
  state: string;
  postcode: string;
  country: string;
  coordinates: ICoordinates;
  raw?: TRaw;
}

export interface ISuggestion<TRaw = unknown> {
  id: string;
  text: string;
  score: number;
  address: IAddress<TRaw>;
}
