import { Injectable, Logger, Inject } from "@nestjs/common";
import { ErrorContext } from "../types";
import { LoggingConfig, LOGGING_CONFIG_TOKEN } from "../config/logging.config";

export interface ErrorMetadata {
  correlationId?: string;
  timestamp: string;
  path?: string;
  method?: string;
  userAgent?: string;
  errorType: string;
  stackTrace?: string;
  provider?: string;
  operation?: string;
  attempt?: number;
  retryable?: boolean;
  statusCode?: number;
  [key: string]: unknown;
}

export interface StructuredLogEntry {
  message: string;
  level: "error" | "warn" | "info" | "debug";
  metadata: ErrorMetadata;
}

@Injectable()
export class ErrorLoggingService {
  private readonly logger = new Logger(ErrorLoggingService.name);

  constructor(
    @Inject(LOGGING_CONFIG_TOKEN) private readonly config: LoggingConfig
  ) {}

  logError(
    error: Error,
    context: ErrorContext,
    additionalData?: Record<string, unknown>
  ): void {
    const logEntry = this.createStructuredLogEntry(
      error,
      context,
      additionalData
    );

    if (this.shouldLogError(error)) {
      this.logger.error(logEntry.message, logEntry.metadata);
    }
  }

  logWarning(
    message: string,
    context: ErrorContext,
    additionalData?: Record<string, unknown>
  ): void {
    const logEntry = this.createStructuredLogEntry(
      new Error(message),
      context,
      additionalData,
      "warn"
    );

    this.logger.warn(logEntry.message, logEntry.metadata);
  }

  logProviderOperation(
    provider: string,
    operation: string,
    correlationId: string,
    data?: Record<string, unknown>
  ): void {
    const metadata = {
      correlationId,
      provider,
      operation,
      timestamp: new Date().toISOString(),
      ...(data || {}),
    };

    this.logger.debug(`Provider operation: ${provider}.${operation}`, metadata);
  }

  private createStructuredLogEntry(
    error: Error,
    context: ErrorContext,
    additionalData?: Record<string, unknown>,
    level: "error" | "warn" | "info" | "debug" = "error"
  ): StructuredLogEntry {
    const metadata: ErrorMetadata = {
      correlationId: context.correlationId,
      timestamp: context.timestamp || new Date().toISOString(),
      path: context.path,
      method: context.method,
      userAgent: context.userAgent,
      errorType: error.constructor.name,
      ...this.extractErrorDetails(error),
      ...(additionalData || {}),
    };

    if (this.config.enableStackTrace && error.stack) {
      metadata.stackTrace = this.truncateStackTrace(error.stack);
    }

    return {
      message: error.message,
      level,
      metadata,
    };
  }

  private extractErrorDetails(error: Error): Record<string, unknown> {
    const details: Record<string, unknown> = {};

    if ("provider" in error) {
      details.provider = error.provider;
    }

    if ("operation" in error) {
      details.operation = error.operation;
    }

    if ("statusCode" in error) {
      details.statusCode = error.statusCode;
    }

    if ("retryable" in error) {
      details.retryable = error.retryable;
    }

    if ("attempt" in error && "context" in error && error.context) {
      const context = error.context as Record<string, unknown>;
      details.attempt = context.attempt;
    }

    if ("code" in error) {
      details.errorCode = error.code;
    }

    if ("details" in error) {
      details.errorDetails = error.details;
    }

    return details;
  }

  private truncateStackTrace(stack: string): string {
    const lines = stack.split("\n");
    const maxLines = Math.min(lines.length, this.config.maxStackDepth + 1);
    return lines.slice(0, maxLines).join("\n");
  }

  private shouldLogError(error: Error): boolean {
    if (!("getStatus" in error)) {
      return true;
    }

    const statusCode = (error as { getStatus?: () => number }).getStatus?.();
    if (typeof statusCode === "number") {
      if (statusCode >= 400 && statusCode < 500) {
        return this.config.level === "debug" || this.config.level === "verbose";
      }

      return statusCode >= 500;
    }

    return true;
  }
}
