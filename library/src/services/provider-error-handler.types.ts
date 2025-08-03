import { ProviderExceptionUnion } from "../exceptions/provider.exceptions";

export interface ProviderErrorContext {
  readonly query: string;
  readonly limit: number;
  readonly provider: string;
}

export interface HttpErrorHandler {
  handleError(error: unknown, context: ProviderErrorContext): never;
}

/**
 * All possible exceptions that can be thrown by providers
 */
export type AllProviderExceptions = ProviderExceptionUnion | Error;

/**
 * Simplified error mapping - just returns the exception to throw
 */
export interface ProviderErrorMapper {
  mapHttpError(
    status: number,
    provider: string,
    errorData?: any
  ): AllProviderExceptions;
  mapNetworkError(provider: string): AllProviderExceptions;
  mapUnknownError(error: unknown, provider: string): AllProviderExceptions;
  shouldRethrowException(error: unknown): boolean;
}
