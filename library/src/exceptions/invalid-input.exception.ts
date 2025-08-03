import { HttpException, HttpStatus } from "@nestjs/common";

export class InvalidInputException extends HttpException {
  constructor(
    message: string,
    public readonly input?: string,
    public readonly validationErrors?: string[]
  ) {
    super(`Invalid input: ${message}`, HttpStatus.BAD_REQUEST);
  }
}
