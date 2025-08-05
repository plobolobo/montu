import { ExceptionFilter, Catch, ArgumentsHost, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { ErrorResponseBuilder, ErrorContext } from "../types";
import { createErrorFromException } from "../mappers";

interface RequestWithCorrelation extends Request {
  correlationId?: string;
}

@Catch()
export class AddressParserExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AddressParserExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithCorrelation>();

    const context: ErrorContext = {
      timestamp: new Date().toISOString(),
      path: request.url || "unknown",
      method: request.method,
      userAgent: request.headers?.["user-agent"],
      correlationId: request.correlationId || undefined,
    };

    const errorMapping = createErrorFromException(exception);

    const errorResponseBuilder = ErrorResponseBuilder.create(
      errorMapping,
      context
    );
    const errorResponse = errorResponseBuilder.build();

    const response = ctx.getResponse<Response>();
    response.status(errorResponseBuilder.getHttpStatus()).json(errorResponse);
  }
}
