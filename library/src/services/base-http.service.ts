import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { Observable, firstValueFrom, throwError } from "rxjs";
import { timeout, catchError } from "rxjs/operators";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import axiosRetry from "axios-retry";
import { HttpErrorInterceptor } from "../interceptors/http-error.interceptor";
import {
  ProviderErrorContext,
  HttpErrorHandler,
  ProviderErrorMapper,
  AllProviderExceptions,
} from "./provider-error-handler.types";
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

export interface BaseHttpOptions {
  baseURL: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  provider: string;
}

@Injectable()
export abstract class BaseHttpService implements HttpErrorHandler {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly httpErrorInterceptor: HttpErrorInterceptor;

  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
    protected readonly options: BaseHttpOptions
  ) {
    this.setupAxiosRetry();
    this.httpErrorInterceptor = new HttpErrorInterceptor({
      timeoutMs: options.timeout || 30000,
      provider: options.provider,
    });
  }

  private setupAxiosRetry() {
    const { retries = 3, retryDelay = 1000 } = this.options;

    axiosRetry(this.httpService.axiosRef, {
      retries,
      retryDelay: axiosRetry.exponentialDelay,
      shouldResetTimeout: true,
      retryCondition: (error) => {
        if (!error.response) return true;

        if (axiosRetry.isNetworkOrIdempotentRequestError(error)) return true;

        const status = error.response.status;
        return [429, 500, 502, 503, 504].includes(status);
      },
      onRetry: (retryCount, error, requestConfig) => {
        this.logger.warn(
          `Retry attempt ${retryCount}/${retries} for ${this.options.provider}`,
          {
            url: requestConfig.url,
            method: requestConfig.method,
            error: error instanceof Error ? error.message : String(error),
          }
        );
      },
    });
  }

  protected async makeRequest<T>(
    config: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const requestConfig: AxiosRequestConfig = {
      baseURL: this.options.baseURL,
      timeout: this.options.timeout || 30000,
      headers: {
        ...this.options.headers,
        ...config.headers,
      },
      ...config,
    };

    this.logger.debug(
      `Making ${config.method?.toUpperCase()} request to ${
        this.options.provider
      }`,
      {
        url: config.url,
        method: config.method,
        provider: this.options.provider,
      }
    );

    return firstValueFrom(
      this.httpService.request<T>(requestConfig).pipe(
        timeout(this.options.timeout || 30000),
        catchError((error) => {
          const errorContext = {
            provider: this.options.provider,
            query: config.params?.q || config.params?.query || "unknown",
            limit: config.params?.limit || 10,
          };

          const mappedException = this.mapError(error, errorContext);

          this.logger.error(
            `${this.options.provider} API error: ${mappedException.message}`,
            {
              error: mappedException.message,
              context: errorContext,
              errorType: mappedException.constructor.name,
            }
          );

          return throwError(() => mappedException);
        })
      )
    );
  }

  protected async get<T>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.makeRequest<T>({
      method: "GET",
      url,
      ...config,
    });
  }

  protected async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.makeRequest<T>({
      method: "POST",
      url,
      data,
      ...config,
    });
  }

  /**
   * Default error mapper for generic provider error handling
   */
  private defaultErrorMapper: ProviderErrorMapper = {
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

  handleError(
    error: unknown,
    context: ProviderErrorContext,
    customErrorMapper?: ProviderErrorMapper
  ): never {
    const errorMapper = customErrorMapper || this.defaultErrorMapper;

    if (errorMapper.shouldRethrowException(error)) {
      throw error;
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

      throw errorMapper.mapHttpError(status!, context.provider, errorData);
    }

    if (error && typeof error === "object" && "request" in error) {
      this.logger.error(`${context.provider} API network error`, {
        ...context,
        error: error instanceof Error ? error.message : "Network error",
      });

      throw errorMapper.mapNetworkError(context.provider);
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.logger.error(
      `Unexpected error in ${context.provider} provider: ${errorMessage}`,
      {
        ...context,
        stack: errorStack,
      }
    );

    throw errorMapper.mapUnknownError(error, context.provider);
  }

  private mapError(
    error: unknown,
    context: ProviderErrorContext
  ): AllProviderExceptions {
    if (this.defaultErrorMapper.shouldRethrowException(error)) {
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
        `Request timeout after ${this.options.timeout}ms`
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
      const { status, data: errorData } = response || {};

      return this.defaultErrorMapper.mapHttpError(
        status!,
        context.provider,
        errorData
      );
    }

    if (error && typeof error === "object" && "request" in error) {
      return this.defaultErrorMapper.mapNetworkError(context.provider);
    }

    return this.defaultErrorMapper.mapUnknownError(error, context.provider);
  }
}
