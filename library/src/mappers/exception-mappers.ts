import { HttpStatus, HttpException } from "@nestjs/common";
import {
  CountryMismatchException,
  NoResultsException,
  ConfigurationException,
  InvalidInputException,
} from "../exceptions";
import { ErrorMapping } from "../types";

enum ErrorTypes {
  COUNTRY_VALIDATION_ERROR = "COUNTRY_VALIDATION_ERROR",
  NO_RESULTS_FOUND = "NO_RESULTS_FOUND",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
  INVALID_INPUT_ERROR = "INVALID_INPUT_ERROR",
  HTTP_ERROR = "HTTP_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

const DEFAULT_ERROR_MESSAGE = "Internal server error";

export const createErrorFromException = (exception: unknown): ErrorMapping => {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const message = exception.message;

    if (exception instanceof CountryMismatchException) {
      return {
        status,
        message,
        details: {
          expectedCountry: exception.expectedCountry,
          actualCountry: exception.actualCountry,
          query: exception.address,
          type: ErrorTypes.COUNTRY_VALIDATION_ERROR,
        },
      };
    }

    if (exception instanceof NoResultsException) {
      return {
        status,
        message,
        details: {
          type: ErrorTypes.NO_RESULTS_FOUND,
        },
      };
    }

    if (exception instanceof ConfigurationException) {
      return {
        status,
        message,
        details: {
          type: ErrorTypes.CONFIGURATION_ERROR,
        },
      };
    }

    if (exception instanceof InvalidInputException) {
      return {
        status,
        message,
        details: {
          type: ErrorTypes.INVALID_INPUT_ERROR,
          input: (exception as any).input,
          validationErrors: (exception as any).validationErrors,
        },
      };
    }

    const response = exception.getResponse();
    const details =
      typeof response === "object" ? response : { message: response };

    return {
      status,
      message,
      details: {
        ...details,
        type: ErrorTypes.HTTP_ERROR,
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
