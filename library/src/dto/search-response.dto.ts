import { z } from "zod";
import { AddressResponseSchema } from "./address-response.dto";

export const SearchMetadataSchema = z.object({
  query: z.string().min(1, { message: "Query is required" }),
  limit: z
    .number()
    .int()
    .min(1, { message: "Limit must be at least 1" })
    .max(100, { message: "Limit must not exceed 100" }),
  resultCount: z
    .number()
    .int()
    .min(0, { message: "Result count must be non-negative" }),
  warnings: z.array(z.string()).optional().default([]),
});

export const ExtendedSearchMetadataSchema = SearchMetadataSchema.extend({
  provider: z.string().min(1, { message: "Provider is required" }),
  processingTime: z
    .number()
    .min(0, { message: "Processing time must be non-negative" }),
  correlationId: z.string().min(1, { message: "Correlation ID is required" }),
  totalAttempts: z
    .number()
    .int()
    .min(1, { message: "Total attempts must be at least 1" })
    .optional(),
});

export const SearchResponseSchema = z.object({
  results: z.array(AddressResponseSchema),
  metadata: SearchMetadataSchema,
});

export const ExtendedSearchResponseSchema = z.object({
  results: z.array(AddressResponseSchema),
  metadata: ExtendedSearchMetadataSchema,
  success: z.boolean().default(true),
});

export type SearchMetadataDto = z.infer<typeof SearchMetadataSchema>;
export type ExtendedSearchMetadataDto = z.infer<
  typeof ExtendedSearchMetadataSchema
>;
export type SearchResponseDto = z.infer<typeof SearchResponseSchema>;
export type ExtendedSearchResponseDto = z.infer<
  typeof ExtendedSearchResponseSchema
>;
