import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Request, Response } from "express";
import { ErrorLoggingService } from "../services/error-logging.service";
import { ErrorContext, ErrorResponseBuilder } from "../types";
import { createErrorFromException } from "../mappers";
import { v4 as uuidv4 } from "uuid";

interface RequestWithCorrelation extends Request {
  correlationId?: string;
}

@Injectable()
@Catch()
export class EnhancedGlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(EnhancedGlobalExceptionFilter.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly errorLoggingService: ErrorLoggingService
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;

    if (!httpAdapter) {
      this.logger.error("Exception in non-HTTP context", { exception });
      return;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithCorrelation>();
    const response = ctx.getResponse<Response>();

    const correlationId =
      (request.headers?.["x-correlation-id"] as string) ||
      request.correlationId ||
      uuidv4();

    request.correlationId = correlationId;

    const errorContext = this.createErrorContext(request, correlationId);

    const errorMapping = createErrorFromException(exception);
    const errorResponseBuilder = ErrorResponseBuilder.create(
      errorMapping,
      errorContext
    );
    const errorResponse = errorResponseBuilder.build();

    this.logError(exception, errorContext, errorResponseBuilder);

    const statusCode = errorResponseBuilder.getHttpStatus();
    httpAdapter.reply(response, errorResponse, statusCode);
  }

  private createErrorContext(
    request: Request,
    correlationId: string
  ): ErrorContext {
    return {
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url || "unknown",
      method: request.method,
      userAgent: request.headers?.["user-agent"],
    };
  }

  private logError(
    exception: unknown,
    context: ErrorContext,
    errorResponseBuilder: ErrorResponseBuilder
  ): void {
    const error = this.ensureError(exception);

    const additionalData = this.extractAdditionalLoggingData(exception);

    if (errorResponseBuilder.shouldLog()) {
      if (errorResponseBuilder.getLogLevel() === "warn") {
        this.errorLoggingService.logWarning(
          error.message,
          context,
          additionalData
        );
      } else {
        this.errorLoggingService.logError(error, context, additionalData);
      }
    }
  }

  private extractAdditionalLoggingData(
    exception: unknown
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      data.statusCode = exception.getStatus();

      const response = exception.getResponse();
      if (typeof response === "object") {
        data.httpExceptionResponse = response;
      }
    }

    if (exception && typeof exception === "object") {
      const obj = exception as Record<string, unknown>;

      const commonProps = ["code", "type", "category", "severity", "source"];
      for (const prop of commonProps) {
        if (prop in obj && obj[prop] !== undefined) {
          data[prop] = obj[prop];
        }
      }
    }

    return data;
  }

  private ensureError(exception: unknown): Error {
    if (exception instanceof Error) {
      return exception;
    }

    if (typeof exception === "string") {
      return new Error(exception);
    }

    if (exception && typeof exception === "object") {
      const obj = exception as Record<string, unknown>;
      const message =
        typeof obj.message === "string" ? obj.message : "Unknown error";
      return new Error(message);
    }

    return new Error("Unknown error occurred");
  }
}
