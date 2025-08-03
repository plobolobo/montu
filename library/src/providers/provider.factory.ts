import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IAddressProvider } from "../interfaces";
import { TomTomAddressProvider } from "./tomtom/tomtom-address.provider";
import { ConfigKey } from "../config";

export type ProviderType = "tomtom" | "google";

@Injectable()
export class AddressProviderFactory {
  constructor(
    @Inject(TomTomAddressProvider)
    private readonly tomtomProvider: TomTomAddressProvider,
    private readonly configService: ConfigService
  ) {}

  createProvider(type?: ProviderType): IAddressProvider<any> {
    const providerType = type || this.getDefaultProvider();

    switch (providerType) {
      case "tomtom":
        return this.tomtomProvider;

      case "google":
        throw new Error("Google Maps provider not implemented yet");

      default:
        throw new Error(`Unknown provider type: ${providerType}`);
    }
  }

  getAllProviders(): IAddressProvider<any>[] {
    return [this.tomtomProvider];
  }

  private getDefaultProvider(): ProviderType {
    return this.configService.get(ConfigKey.DEFAULT_PROVIDER) || "tomtom";
  }
}
