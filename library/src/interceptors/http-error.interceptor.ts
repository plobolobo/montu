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
  HttpException,
  BadRequestException,
  UnauthorizedException,
  HttpStatus,
  BadGatewayException,
  ServiceUnavailableException,
  InternalServerErrorException,
} from "@nestjs/common";

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
        provider: string
      ): AllProviderExceptions => {
        if (status === 400) {
          return new BadRequestException({
            message: "Invalid query parameters",
            provider,
            statusCode: status,
          });
        }
        if (status === 401 || status === 403) {
          return new UnauthorizedException({
            message: `${provider} authentication failed`,
            provider,
            details: "Invalid API key or insufficient permissions",
            statusCode: status,
          });
        }
        if (status === 429) {
          return new HttpException(
            {
              message: `${provider} rate limit exceeded`,
              provider,
              details: "Too many requests",
              statusCode: status,
            },
            HttpStatus.TOO_MANY_REQUESTS
          );
        }
        if (status && status >= 500) {
          return new BadGatewayException({
            message: `${provider} service unavailable`,
            provider,
            details: `Service unavailable (HTTP ${status})`,
            statusCode: status,
          });
        }
        return new BadGatewayException({
          message: `Request failed with status ${status}`,
          provider,
          details: `HTTP ${status}`,
          statusCode: status || 500,
        });
      },

      mapNetworkError: (provider: string): AllProviderExceptions => {
        return new ServiceUnavailableException({
          message: `Failed to connect to ${provider}`,
          provider,
          details: "Failed to connect to API",
        });
      },

      mapUnknownError: (
        error: unknown,
        provider: string
      ): AllProviderExceptions => {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        return new InternalServerErrorException({
          message: `${provider} unexpected error`,
          provider,
          details: errorMessage,
        });
      },

      shouldRethrowException: (error: unknown): boolean => {
        return error instanceof HttpException;
      },
    };
  }

  intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
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
      return new BadGatewayException({
        message: `${context.provider} service unavailable`,
        provider: context.provider,
        details: `Request timeout after ${this.options.timeoutMs}ms`,
      });
    }

    if (error && typeof error === "object" && "response" in error) {
      const httpError = error as {
        response?: {
          status?: number;
          data?: unknown;
          statusText?: string;
        };
        request?: unknown;
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
