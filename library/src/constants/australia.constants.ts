export const AUSTRALIA = {
  COUNTRY_CODE: "AU",
  COUNTRY_CODE_ISO3: "AUS",
  COUNTRY_NAME: "Australia",
} as const;

export const AUSTRALIAN_STATES = [
  "NSW",
  "VIC",
  "QLD",
  "WA",
  "SA",
  "TAS",
  "ACT",
  "NT",
] as const;

export type AustralianState = (typeof AUSTRALIAN_STATES)[number];
