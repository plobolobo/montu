import { HttpStatus } from "@nestjs/common";

export interface ErrorResponse {
  readonly success: false;
  readonly error: ErrorDetails;
}

export interface ErrorDetails {
  readonly message: string;
  readonly statusCode: HttpStatus;
  readonly timestamp: string;
  readonly path: string;
  readonly type?: string;
  readonly [key: string]: unknown;
}

export interface ErrorMapping {
  readonly status: HttpStatus;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly shouldLog?: boolean;
  readonly logLevel?: "error" | "warn" | "debug";
}

export type ErrorMapper<T = unknown> = (exception: T) => ErrorMapping;

export interface ErrorContext {
  readonly timestamp: string;
  readonly path: string;
  readonly method?: string;
  readonly userAgent?: string;
  readonly correlationId?: string;
}

export class ErrorResponseBuilder {
  private constructor(
    private readonly mapping: ErrorMapping,
    private readonly context: ErrorContext
  ) {}

  static create(
    mapping: ErrorMapping,
    context: ErrorContext
  ): ErrorResponseBuilder {
    return new ErrorResponseBuilder(mapping, context);
  }

  build(): ErrorResponse {
    return {
      success: false as const,
      error: {
        message: this.mapping.message,
        statusCode: this.mapping.status,
        timestamp: this.context.timestamp,
        path: this.context.path,
        ...this.mapping.details,
      },
    };
  }

  getHttpStatus(): HttpStatus {
    return this.mapping.status;
  }

  shouldLog(): boolean {
    return this.mapping.shouldLog ?? false;
  }

  getLogLevel(): "error" | "warn" | "debug" {
    return this.mapping.logLevel ?? "error";
  }

  getLogMessage(): string {
    return `${this.mapping.message} [${this.mapping.status}] - ${this.context.path}`;
  }
}
