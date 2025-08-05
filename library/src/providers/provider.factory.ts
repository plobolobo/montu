import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IAddressProvider } from "../interfaces";
import { TomTomAddressProvider } from "./tomtom/tomtom-address.provider";
import { ConfigKey } from "../config";
import { PROVIDER_NAMES } from "../constants";

@Injectable()
export class AddressProviderFactory {
  constructor(
    @Inject(TomTomAddressProvider)
    private readonly tomtomProvider: TomTomAddressProvider,
    private readonly configService: ConfigService
  ) {}

  createProvider(type?: typeof PROVIDER_NAMES): IAddressProvider<unknown> {
    const defaultProvider =
      this.configService.get(ConfigKey.DEFAULT_PROVIDER) ||
      PROVIDER_NAMES.TOMTOM;

    const providerType = type || defaultProvider;

    switch (providerType) {
      case PROVIDER_NAMES.TOMTOM:
        return this.tomtomProvider;

      // example provider, add more as needed
      case PROVIDER_NAMES.GOOGLE:
        throw new Error("Google Maps provider not implemented yet");

      default:
        throw new Error(`Unknown provider type: ${providerType}`);
    }
  }
}
