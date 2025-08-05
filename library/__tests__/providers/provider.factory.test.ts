import { describe, it, expect, vi, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AddressProviderFactory } from "../../src/providers/provider.factory";
import { TomTomAddressProvider } from "../../src/providers/tomtom/tomtom-address.provider";
import { ConfigKey } from "../../src/config";
import { PROVIDER_NAMES } from "../../src/constants";

type ProviderType = (typeof PROVIDER_NAMES)[keyof typeof PROVIDER_NAMES];

describe("AddressProviderFactory", () => {
  let factory: AddressProviderFactory;
  let configService: ConfigService;
  let tomtomProvider: TomTomAddressProvider;

  beforeEach(async () => {
    const mockTomTomProvider = {
      getSuggestions: vi.fn(),
      name: "TomTom",
    } as any;

    const mockConfigService = {
      get: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressProviderFactory,
        { provide: TomTomAddressProvider, useValue: mockTomTomProvider },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    factory = module.get<AddressProviderFactory>(AddressProviderFactory);
    configService = module.get<ConfigService>(ConfigService);
    tomtomProvider = module.get<TomTomAddressProvider>(TomTomAddressProvider);
  });

  describe("constructor", () => {
    it("should be defined", () => {
      expect(factory).toBeDefined();
    });

    it("should inject dependencies correctly", () => {
      expect(factory).toBeInstanceOf(AddressProviderFactory);
    });
  });

  describe("createProvider", () => {
    describe("with explicit provider type", () => {
      it("should return TomTom provider when type is 'tomtom'", () => {
        const result = factory.createProvider("tomtom");

        expect(result).toBe(tomtomProvider);
        expect(result).toEqual(
          expect.objectContaining({
            getSuggestions: expect.any(Function),
          })
        );
      });

      it("should throw error when type is 'google'", () => {
        expect(() => factory.createProvider("google")).toThrow(
          "Google Maps provider not implemented yet"
        );
      });

      it("should throw error for unknown provider type", () => {
        const unknownType = "unknown" as ProviderType;

        expect(() => factory.createProvider(unknownType)).toThrow(
          "Unknown provider type: unknown"
        );
      });
    });

    describe("without explicit provider type (default)", () => {
      it("should use TomTom as default when no config is set", () => {
        configService.get = vi.fn().mockReturnValue(undefined);

        const result = factory.createProvider();

        expect(configService.get).toHaveBeenCalledWith(
          ConfigKey.DEFAULT_PROVIDER
        );
        expect(result).toBe(tomtomProvider);
      });

      it("should use configured default provider", () => {
        configService.get = vi.fn().mockReturnValue("tomtom");

        const result = factory.createProvider();

        expect(configService.get).toHaveBeenCalledWith(
          ConfigKey.DEFAULT_PROVIDER
        );
        expect(result).toBe(tomtomProvider);
      });

      it("should throw error when default is set to unimplemented provider", () => {
        configService.get = vi.fn().mockReturnValue("google");

        expect(() => factory.createProvider()).toThrow(
          "Google Maps provider not implemented yet"
        );
      });

      it("should throw error when default is set to unknown provider", () => {
        configService.get = vi.fn().mockReturnValue("unknown");

        expect(() => factory.createProvider()).toThrow(
          "Unknown provider type: unknown"
        );
      });
    });

    describe("return value validation", () => {
      it("should return object implementing IAddressProvider interface", () => {
        const result = factory.createProvider("tomtom");

        expect(result).toHaveProperty("getSuggestions");
        expect(typeof result.getSuggestions).toBe("function");
      });

      it("should return the same instance on multiple calls", () => {
        const result1 = factory.createProvider("tomtom");
        const result2 = factory.createProvider("tomtom");

        expect(result1).toBe(result2);
        expect(result1).toBe(tomtomProvider);
      });
    });
  });

  describe("configuration integration", () => {
    it("should respect configuration changes", () => {
      configService.get = vi.fn().mockReturnValue("tomtom");
      const result1 = factory.createProvider();
      expect(result1).toBe(tomtomProvider);

      configService.get = vi.fn().mockReturnValue("google");
      expect(() => factory.createProvider()).toThrow(
        "Google Maps provider not implemented yet"
      );
    });

    it("should handle missing configuration gracefully", () => {
      configService.get = vi.fn().mockReturnValue(null);

      const result = factory.createProvider();

      expect(result).toBe(tomtomProvider);
    });
  });

  describe("error handling", () => {
    it("should handle config service errors gracefully", () => {
      configService.get = vi.fn().mockImplementation(() => {
        throw new Error("Config service error");
      });

      expect(() => factory.createProvider()).toThrow("Config service error");
    });
  });

  describe("dependency injection", () => {
    it("should properly inject TomTom provider", () => {
      const provider = factory.createProvider("tomtom");
      expect(provider).toBeDefined();
      expect(provider).toBe(tomtomProvider);
    });

    it("should properly inject ConfigService", () => {
      configService.get = vi.fn().mockReturnValue("tomtom");

      factory.createProvider();

      expect(configService.get).toHaveBeenCalledWith(
        ConfigKey.DEFAULT_PROVIDER
      );
    });
  });
});
