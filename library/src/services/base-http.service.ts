import { Injectable, Logger, ExecutionContext } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import axiosRetry from "axios-retry";
import { HttpErrorInterceptor } from "../interceptors/http-error.interceptor";

export interface BaseHttpOptions {
  baseURL: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  provider: string;
}

@Injectable()
export abstract class BaseHttpService {
  protected readonly logger = new Logger(this.constructor.name);
  private readonly httpErrorInterceptor: HttpErrorInterceptor;

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
    const { retries = 3 } = this.options;

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
      this.httpErrorInterceptor.intercept(
        {
          switchToHttp: () => ({
            getRequest: () => ({
              query: config.params || {},
              body: config.data || {},
            }),
          }),
        } as ExecutionContext,
        {
          handle: () => this.httpService.request<T>(requestConfig),
        }
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
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.makeRequest<T>({
      method: "POST",
      url,
      data,
      ...config,
    });
  }
}
