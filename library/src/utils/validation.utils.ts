import { BadRequestException } from "@nestjs/common";
import { ZodError } from "zod";
import { AddressSearchSchema, AddressSearchDto } from "../dto";
import {
  ValidationError,
  ValidationOutcome,
  ValidationWarningsBuilder,
  ValidationConfig,
} from "../types";
import { QUERY_VALIDATION } from "../config";

const VALIDATION_CONFIG: ValidationConfig = {
  minLength: QUERY_VALIDATION.MIN_LENGTH,
  maxLength: QUERY_VALIDATION.MAX_LENGTH,
  optimalMinLength: QUERY_VALIDATION.OPTIMAL_MIN_LENGTH,
  optimalMaxLength: QUERY_VALIDATION.OPTIMAL_MAX_LENGTH,
  minLimit: 1,
  maxLimit: 100,
};

export const validateAddressInput = (input: {
  query: string;
  limit: number;
  country?: string;
}): ValidationOutcome<AddressSearchDto> => {
  try {
    const validatedData = AddressSearchSchema.parse(input);
    const warnings = generateValidationWarnings(validatedData);

    return {
      isValid: true as const,
      data: validatedData,
      warnings,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
        code: err.code,
        received: "received" in err ? err.received : undefined,
      }));

      return {
        isValid: false as const,
        errors,
      };
    }

    return {
      isValid: false as const,
      errors: [
        {
          field: "unknown",
          message: "Validation failed",
          code: "unknown",
        },
      ],
    };
  }
};

const generateValidationWarnings = (
  data: AddressSearchDto
): readonly string[] => {
  const builder = new ValidationWarningsBuilder();

  if (data.query.length < VALIDATION_CONFIG.optimalMinLength) {
    builder.addQueryTooShort(
      data.query.length,
      VALIDATION_CONFIG.optimalMinLength
    );
  }

  if (data.query.length > VALIDATION_CONFIG.optimalMaxLength) {
    builder.addQueryTooLong(
      data.query.length,
      VALIDATION_CONFIG.optimalMaxLength
    );
  }

  return builder.build();
};

export const createValidationException = (
  validationError: ValidationError
): BadRequestException => {
  const messages = validationError.errors.map(
    (err) => `${err.field}: ${err.message}`
  );

  return new BadRequestException({
    message: "Validation failed",
    errors: messages,
    statusCode: 400,
    type: "VALIDATION_ERROR",
    timestamp: new Date().toISOString(),
  });
};

export const getValidatedDataOrThrow = (input: {
  query: string;
  limit: number;
}): { data: AddressSearchDto; warnings: readonly string[] } => {
  const outcome = validateAddressInput(input);

  if (!outcome.isValid) {
    throw createValidationException(outcome);
  }

  return {
    data: outcome.data,
    warnings: outcome.warnings,
  };
};
