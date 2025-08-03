import { HttpException, HttpStatus } from "@nestjs/common";

export class NoResultsException extends HttpException {
  constructor(query: string, provider?: string) {
    super(
      `No address suggestions found for query: "${query}"${
        provider ? ` (${provider})` : ""
      }`,
      HttpStatus.NOT_FOUND
    );
  }
}
