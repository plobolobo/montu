import { ExceptionFilter, Catch, ArgumentsHost, Logger } from "@nestjs/common";
import type { Response } from "express";
import { ErrorResponseBuilder, ErrorContext } from "../types";
import { createErrorFromException } from "../mappers";

@Catch()
export class AddressParserExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AddressParserExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    const context: ErrorContext = {
      timestamp: new Date().toISOString(),
      path: request.url || "unknown",
      method: request.method,
      userAgent: request.headers?.["user-agent"],
      correlationId: (request as any).correlationId || undefined,
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
