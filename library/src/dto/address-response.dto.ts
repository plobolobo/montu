import { z } from "zod";
import { CoordinatesSchema } from "./coordinates.dto";
import { AUSTRALIAN_STATES } from "../constants";

export const AddressResponseSchema = z.object({
  id: z.string().min(1, { message: "Address ID is required" }),
  fullAddress: z.string().min(1, { message: "Full address is required" }),
  streetNumber: z.string().optional(),
  streetName: z.string().optional(),
  suburb: z.string().optional(),
  municipality: z.string().optional(),
  state: z.enum(AUSTRALIAN_STATES, {
    errorMap: () => ({ message: "State must be a valid Australian state" }),
  }),
  postcode: z
    .string()
    .regex(/^\d{4}$/, { message: "Postcode must be a 4-digit number" }),
  country: z.string().min(1, { message: "Country is required" }),
  coordinates: CoordinatesSchema,
  confidence: z
    .number()
    .min(0, { message: "Confidence must be between 0 and 1" })
    .max(1, { message: "Confidence must be between 0 and 1" })
    .optional(),
});

export type AddressResponseDto = z.infer<typeof AddressResponseSchema>;
