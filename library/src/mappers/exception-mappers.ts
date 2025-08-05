import { HttpStatus, HttpException } from "@nestjs/common";
import { ErrorMapping } from "../types";

const ErrorTypes = {
  COUNTRY_VALIDATION_ERROR: "COUNTRY_VALIDATION_ERROR",
  NO_RESULTS_FOUND: "NO_RESULTS_FOUND",
  NOT_FOUND_ERROR: "NOT_FOUND_ERROR",
  CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
  INVALID_INPUT_ERROR: "INVALID_INPUT_ERROR",
  HTTP_ERROR: "HTTP_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

const DEFAULT_ERROR_MESSAGE = "Internal server error";

export const createErrorFromException = (exception: unknown): ErrorMapping => {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const message = exception.message;
    const response = exception.getResponse();

    const details: Record<string, unknown> =
      typeof response === "object" && response !== null
        ? { ...response }
        : { message: response };

    const errorType = (() => {
      switch (status) {
        case HttpStatus.UNPROCESSABLE_ENTITY:
          return "expectedCountry" in details
            ? ErrorTypes.COUNTRY_VALIDATION_ERROR
            : ErrorTypes.HTTP_ERROR;
        case HttpStatus.NOT_FOUND:
          return "query" in details
            ? ErrorTypes.NO_RESULTS_FOUND
            : ErrorTypes.NOT_FOUND_ERROR;
        case HttpStatus.INTERNAL_SERVER_ERROR:
          return message.includes("Configuration")
            ? ErrorTypes.CONFIGURATION_ERROR
            : ErrorTypes.HTTP_ERROR;
        case HttpStatus.BAD_REQUEST:
          return ErrorTypes.INVALID_INPUT_ERROR;
        default:
          return ErrorTypes.HTTP_ERROR;
      }
    })();

    return {
      status,
      message,
      details: {
        ...details,
        type: errorType,
      } as Readonly<Record<string, unknown>>,
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: DEFAULT_ERROR_MESSAGE,
    details: {
      type: ErrorTypes.UNKNOWN_ERROR,
    },
  };
};
