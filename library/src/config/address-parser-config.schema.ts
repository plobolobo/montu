import { z } from "zod";
import { TOMTOM_BASE_URL, AUSTRALIA } from "../constants";

export const AddressParserConfigSchema = z.object({
  TOMTOM_API_KEY: z.string().min(1, "API key is required"),
  BASE_URL: z.string().url().default(TOMTOM_BASE_URL),
  VERSION: z.string().default("2"),
  COUNTRY_SET: z.string().default(AUSTRALIA.COUNTRY_CODE),
  LIMIT: z.coerce.number().min(1).max(100).default(10),
  RETRY_ATTEMPTS: z.coerce.number().min(0).max(10).default(3),
  RETRY_DELAY_BASE: z.coerce.number().min(100).default(1000),
  REQUEST_TIMEOUT: z.coerce.number().min(1000).default(30000),
});

export type AddressParserConfig = z.infer<typeof AddressParserConfigSchema>;
