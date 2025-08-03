import { z } from "zod";
import { QUERY_VALIDATION } from "../config/validation.constants";
import { AUSTRALIA } from "../constants";

/**
 * Validates if a country value represents Australia
 */
const isValidAustralianCountry = (value: string): boolean => {
  const normalizedValue = value.toLowerCase().trim();
  const validAustralianValues = [
    AUSTRALIA.COUNTRY_NAME.toLowerCase(),
    AUSTRALIA.COUNTRY_CODE.toLowerCase(),
    AUSTRALIA.COUNTRY_CODE_ISO3.toLowerCase(),
  ];
  return validAustralianValues.includes(normalizedValue);
};

export const AddressSearchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(QUERY_VALIDATION.MIN_LENGTH, {
      message: `Query must be at least ${QUERY_VALIDATION.MIN_LENGTH} characters long`,
    })
    .max(QUERY_VALIDATION.MAX_LENGTH, {
      message: `Query must not exceed ${QUERY_VALIDATION.MAX_LENGTH} characters`,
    }),
  limit: z
    .number()
    .int()
    .min(1, { message: "Limit must be at least 1" })
    .max(100, { message: "Limit must not exceed 100" })
    .optional()
    .default(10),
  country: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => {
        if (value === undefined) return true;
        return isValidAustralianCountry(value);
      },
      {
        message: `Only Australian addresses are supported. Accepted values: ${AUSTRALIA.COUNTRY_NAME}, ${AUSTRALIA.COUNTRY_CODE}, ${AUSTRALIA.COUNTRY_CODE_ISO3}`,
      }
    ),
});

export type AddressSearchDto = z.infer<typeof AddressSearchSchema>;
