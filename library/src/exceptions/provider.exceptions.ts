import { HttpException, HttpStatus } from "@nestjs/common";

export class ProviderException extends HttpException {
  constructor(
    public readonly provider: string,
    public readonly category: string,
    public readonly details: string,
    message: string,
    statusCode: number = HttpStatus.BAD_GATEWAY
  ) {
    super(
      {
        error: "Provider Error",
        message,
        details,
        provider,
        category,
        statusCode,
      },
      statusCode
    );
  }
}

export class ProviderAuthenticationError extends ProviderException {
  constructor(provider: string, details: string = "Authentication failed") {
    super(
      provider,
      "Authentication",
      details,
      `${provider} authentication failed`,
      HttpStatus.UNAUTHORIZED
    );
  }
}

export class ProviderRateLimitError extends ProviderException {
  constructor(provider: string, details: string = "Rate limit exceeded") {
    super(
      provider,
      "RateLimit",
      details,
      `${provider} rate limit exceeded`,
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}

export class ProviderServiceError extends ProviderException {
  constructor(provider: string, details: string = "Service unavailable") {
    super(
      provider,
      "ServerError",
      details,
      `${provider} service unavailable`,
      HttpStatus.BAD_GATEWAY
    );
  }
}

export class ProviderNetworkError extends ProviderException {
  constructor(
    provider: string,
    details: string = "Network connectivity issue"
  ) {
    super(
      provider,
      "NetworkError",
      details,
      `Failed to connect to ${provider}`,
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }
}

export class ProviderUnknownError extends ProviderException {
  constructor(provider: string, details: string = "Unknown error occurred") {
    super(
      provider,
      "UnknownError",
      details,
      `${provider} unexpected error`,
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

export type ProviderExceptionUnion =
  | ProviderException
  | ProviderAuthenticationError
  | ProviderRateLimitError
  | ProviderServiceError
  | ProviderNetworkError
  | ProviderUnknownError;
