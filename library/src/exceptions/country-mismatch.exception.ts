import { HttpException, HttpStatus } from "@nestjs/common";

export class CountryMismatchException extends HttpException {
  constructor(
    public readonly expectedCountry: string,
    public readonly actualCountry: string,
    public readonly address: string
  ) {
    super(
      `Address validation failed: Expected ${expectedCountry} address, received ${actualCountry} for "${address}"`,
      HttpStatus.UNPROCESSABLE_ENTITY
    );
  }
}
