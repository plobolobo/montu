/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { IAddressProvider, ISuggestion } from "../../interfaces";

@Injectable()
export class GoogleAddressProvider implements IAddressProvider<any> {
  private readonly logger = new Logger(GoogleAddressProvider.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSuggestions(query: string, limit = 10): Promise<ISuggestion<any>[]> {
    throw new Error("Google Maps provider not implemented yet");
  }
}
