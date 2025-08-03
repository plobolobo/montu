import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError, timeout } from "rxjs/operators";
import {
  ProviderErrorContext,
  ProviderErrorMapper,
  AllProviderExceptions,
} from "../services/provider-error-handler.types";
import {
  ProviderException,
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderServiceError,
  ProviderNetworkError,
  ProviderUnknownError,
  InvalidInputException,
  NoResultsException,
  CountryMismatchException,
} from "../exceptions";

export interface HttpErrorInterceptorOptions {
  timeoutMs?: number;
  provider: string;
  errorMapper?: ProviderErrorMapper;
}

@Injectable()
export class HttpErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpErrorInterceptor.name);
  private readonly defaultErrorMapper: ProviderErrorMapper;

  constructor(private readonly options: HttpErrorInterceptorOptions) {
    this.defaultErrorMapper = {
      mapHttpError: (
        status: number,
        provider: string,
        errorData?: any
      ): AllProviderExceptions => {
        if (status === 400) {
          return new InvalidInputException("Invalid query parameters");
        }
        if (status === 401 || status === 403) {
          return new ProviderAuthenticationError(
            provider,
            "Invalid API key or insufficient permissions"
          );
        }
        if (status === 429) {
          return new ProviderRateLimitError(provider, "Too many requests");
        }
        if (status && status >= 500) {
          return new ProviderServiceError(
            provider,
            `Service unavailable (HTTP ${status})`
          );
        }
        return new ProviderException(
          provider,
          "HTTPError",
          `HTTP ${status}`,
          `Request failed with status ${status}`,
          status || 500
        );
      },

      mapNetworkError: (provider: string): AllProviderExceptions => {
        return new ProviderNetworkError(provider, "Failed to connect to API");
      },

      mapUnknownError: (
        error: unknown,
        provider: string
      ): AllProviderExceptions => {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        return new ProviderUnknownError(provider, errorMessage);
      },

      shouldRethrowException: (error: unknown): boolean => {
        return (
          error instanceof InvalidInputException ||
          error instanceof NoResultsException ||
          error instanceof CountryMismatchException ||
          error instanceof ProviderException ||
          error instanceof ProviderAuthenticationError ||
          error instanceof ProviderRateLimitError ||
          error instanceof ProviderServiceError ||
          error instanceof ProviderNetworkError ||
          error instanceof ProviderUnknownError
        );
      },
    };
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const { timeoutMs = 30000, provider, errorMapper } = this.options;
    const activeErrorMapper = errorMapper || this.defaultErrorMapper;

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((error) => {
        const errorContext = this.createErrorContext(context, provider);
        const mappedException = this.mapErrorToException(
          error,
          errorContext,
          activeErrorMapper
        );

        this.logger.error(
          `${provider} API error intercepted: ${mappedException.message}`,
          {
            error: mappedException.message,
            context: errorContext,
            errorType: mappedException.constructor.name,
          }
        );

        return throwError(() => mappedException);
      })
    );
  }

  private createErrorContext(
    context: ExecutionContext,
    provider: string
  ): ProviderErrorContext {
    const request = context.switchToHttp().getRequest();

    return {
      provider,
      query: request.query?.query || request.body?.query || "unknown",
      limit: request.query?.limit || request.body?.limit || 10,
    };
  }

  private mapErrorToException(
    error: unknown,
    context: ProviderErrorContext,
    errorMapper: ProviderErrorMapper
  ): AllProviderExceptions {
    if (errorMapper.shouldRethrowException(error)) {
      throw error;
    }

    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "TimeoutError"
    ) {
      return new ProviderServiceError(
        context.provider,
        `Request timeout after ${this.options.timeoutMs}ms`
      );
    }

    if (error && typeof error === "object" && "response" in error) {
      const httpError = error as {
        response?: {
          status?: number;
          data?: any;
          statusText?: string;
        };
        request?: any;
      };

      const { response } = httpError;
      const { status, data: errorData, statusText } = response || {};

      this.logger.error(`${context.provider} API HTTP error`, {
        ...context,
        status,
        statusText,
        errorData,
      });

      return errorMapper.mapHttpError(status!, context.provider, errorData);
    }

    if (error && typeof error === "object" && "request" in error) {
      this.logger.error(`${context.provider} API network error`, {
        ...context,
        error: String(error),
      });

      return errorMapper.mapNetworkError(context.provider);
    }

    this.logger.error(`${context.provider} API unknown error`, {
      ...context,
      error: String(error),
    });

    return errorMapper.mapUnknownError(error, context.provider);
  }
}
