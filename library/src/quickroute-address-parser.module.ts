import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { QuickrouteAddressParserService } from "./services";
import { ErrorLoggingService } from "./services/error-logging.service";

import { TomTomAddressProvider } from "./providers";
import { AddressProviderFactory } from "./providers/provider.factory";
import { GoogleAddressProvider } from "./providers/google/google-address.provider";

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
}

@Module({})
export class QuickrouteAddressParserModule {
  static register(
    options: QuickrouteAddressParserModuleOptions = {}
  ): DynamicModule {
    return {
      module: QuickrouteAddressParserModule,
      global: options.isGlobal || false,
      imports: [
        ConfigModule.forRoot({
          validate: (config) => AddressParserConfigSchema.parse(config),
          validationOptions: {
            allowUnknown: true,
            abortEarly: false,
          },
          ignoreEnvFile: false,
          isGlobal: false,
        }),
        HttpModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            timeout: configService.get(REQUEST_TIMEOUT, REQUEST_TIMEOUT_MS),
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
          useFactory: () => ({
            ...createLoggingConfig(),
            ...options.loggingConfig,
          }),
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
