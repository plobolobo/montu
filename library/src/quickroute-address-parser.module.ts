import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { APP_FILTER } from "@nestjs/core";
import { QuickrouteAddressParserService } from "./services";
import { ErrorLoggingService } from "./services/error-logging.service";

import {
  TomTomAddressProvider,
  AddressProviderFactory,
  GoogleAddressProvider,
} from "./providers";

import { EnhancedGlobalExceptionFilter } from "./filters/enhanced-global-exception.filter";
import { ADDRESS_PROVIDER_TOKEN } from "./constants";
import { AddressParserConfigSchema } from "./config";
import {
  LoggingConfig,
  createLoggingConfig,
  LOGGING_CONFIG_TOKEN,
} from "./config/logging.config";

const REQUEST_TIMEOUT = "REQUEST_TIMEOUT";
const REQUEST_TIMEOUT_MS = 30000;

export interface QuickrouteAddressParserModuleOptions {
  isGlobal?: boolean;
  loggingConfig?: Partial<LoggingConfig>;
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}

@Module({})
export class QuickrouteAddressParserModule {
  static register(
    options: QuickrouteAddressParserModuleOptions
  ): DynamicModule {
    return {
      module: QuickrouteAddressParserModule,
      global: options.isGlobal || false,
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          isGlobal: false,
          load: [
            () => {
              const config = {
                TOMTOM_API_KEY: options.apiKey,
                ...(options.baseUrl && { BASE_URL: options.baseUrl }),
                ...(options.timeout && { REQUEST_TIMEOUT: options.timeout }),
                ...(options.retries && { RETRY_ATTEMPTS: options.retries }),
              };
              return AddressParserConfigSchema.parse(config);
            },
          ],
        }),
        HttpModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            timeout:
              options.timeout ||
              configService.get(REQUEST_TIMEOUT, REQUEST_TIMEOUT_MS),
            maxRedirects: 5,
          }),
        }),
      ],
      providers: [
        TomTomAddressProvider,
        GoogleAddressProvider,
        AddressProviderFactory,
        {
          provide: ADDRESS_PROVIDER_TOKEN,
          useClass: TomTomAddressProvider,
        },
        {
          provide: LOGGING_CONFIG_TOKEN,
          useFactory: () => createLoggingConfig(options.loggingConfig),
        },
        ErrorLoggingService,
        QuickrouteAddressParserService,
        {
          provide: APP_FILTER,
          useClass: EnhancedGlobalExceptionFilter,
        },
      ],
      exports: [
        QuickrouteAddressParserService,
        AddressProviderFactory,
        ErrorLoggingService,
      ],
    };
  }
}
