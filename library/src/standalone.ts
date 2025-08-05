import { NestFactory } from "@nestjs/core";
import { INestApplicationContext } from "@nestjs/common";
import { QuickrouteAddressParserModule } from "./quickroute-address-parser.module";
import { QuickrouteAddressParserService } from "./services/quickroute-address-parser.service";
import { StandaloneConfig } from "./types/standalone.types";
import { SearchResult } from "./types";

export class QuickrouteAddressParser {
  private app: INestApplicationContext | null = null;
  private service: QuickrouteAddressParserService | null = null;
  private isInitialized = false;

  constructor(private config: StandaloneConfig) {}

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.app = await NestFactory.createApplicationContext(
      QuickrouteAddressParserModule.register({
        isGlobal: true,
        apiKey: this.config.apiKey,
        baseUrl: this.config.baseUrl,
        timeout: this.config.timeout,
        retries: this.config.retries,
        loggingConfig: this.config.loggingConfig,
      }),
      {
        logger: this.config.enableLogging
          ? ["log", "error", "warn", "debug"]
          : false,
      }
    );

    this.service = this.app.get(QuickrouteAddressParserService);
    this.isInitialized = true;
  }

  async searchAddresses(query: string, limit = 10): Promise<SearchResult> {
    await this.initialize();

    if (!this.service) {
      throw new Error("Failed to initialize address parser service");
    }

    return this.service.searchAddresses(query, limit);
  }

  async close(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.app = null;
      this.service = null;
      this.isInitialized = false;
    }
  }
}

export * from "./interfaces";
export * from "./dto";
export * from "./types";

export { QuickrouteAddressParserService } from "./services/quickroute-address-parser.service";

export default QuickrouteAddressParser;
