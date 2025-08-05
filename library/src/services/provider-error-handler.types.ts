import { HttpException } from "@nestjs/common";

export interface ProviderErrorContext {
  readonly query: string;
  readonly limit: number;
  readonly provider: string;
}

export type AllProviderExceptions = HttpException | Error;
export interface ProviderErrorMapper {
  mapHttpError(
    status: number,
    provider: string,
    errorData?: unknown
  ): AllProviderExceptions;
  mapNetworkError(provider: string): AllProviderExceptions;
  mapUnknownError(error: unknown, provider: string): AllProviderExceptions;
  shouldRethrowException(error: unknown): boolean;
}
