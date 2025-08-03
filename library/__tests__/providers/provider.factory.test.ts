import { describe, it, expect, vi, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AddressProviderFactory, ProviderType } from "../../src/providers/provider.factory";
import { TomTomAddressProvider } from "../../src/providers/tomtom/tomtom-address.provider";
import { ConfigKey } from "../../src/config";
import { IAddressProvider } from "../../src/interfaces";

describe("AddressProviderFactory", () => {
  let factory: AddressProviderFactory;
  let configService: ConfigService;
  let tomtomProvider: TomTomAddressProvider;

  beforeEach(async () => {
    // Mock TomTom provider
    const mockTomTomProvider = {
      getSuggestions: vi.fn(),
      name: "TomTom",
    } as any;

    // Mock ConfigService
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
        expect(result).toEqual(expect.objectContaining({
          getSuggestions: expect.any(Function),
        }));
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

      it("should handle invalid provider types gracefully", () => {
        const invalidTypes = ["invalid", "bing", "here", "mapbox"];
        
        invalidTypes.forEach(type => {
          expect(() => factory.createProvider(type as ProviderType)).toThrow(
            `Unknown provider type: ${type}`
          );
        });
      });
    });

    describe("without explicit provider type (default)", () => {
      it("should use TomTom as default when no config is set", () => {
        configService.get = vi.fn().mockReturnValue(undefined);

        const result = factory.createProvider();

        expect(configService.get).toHaveBeenCalledWith(ConfigKey.DEFAULT_PROVIDER);
        expect(result).toBe(tomtomProvider);
      });

      it("should use configured default provider", () => {
        configService.get = vi.fn().mockReturnValue("tomtom");

        const result = factory.createProvider();

        expect(configService.get).toHaveBeenCalledWith(ConfigKey.DEFAULT_PROVIDER);
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

        // Check that it has the required interface methods
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

  describe("getAllProviders", () => {
    it("should return array containing all available providers", () => {
      const providers = factory.getAllProviders();

      expect(providers).toBeInstanceOf(Array);
      expect(providers).toHaveLength(1);
      expect(providers[0]).toBe(tomtomProvider);
    });

    it("should return array with TomTom provider", () => {
      const providers = factory.getAllProviders();

      expect(providers).toContain(tomtomProvider);
      
      // Verify each provider implements the interface
      providers.forEach(provider => {
        expect(provider).toHaveProperty("getSuggestions");
        expect(typeof provider.getSuggestions).toBe("function");
      });
    });

    it("should return consistent results on multiple calls", () => {
      const providers1 = factory.getAllProviders();
      const providers2 = factory.getAllProviders();

      expect(providers1).toEqual(providers2);
      expect(providers1[0]).toBe(providers2[0]);
    });

    it("should return immutable reference to providers array", () => {
      const providers = factory.getAllProviders();
      const originalLength = providers.length;

      // Try to modify the returned array
      providers.push({} as any);

      // Get fresh array and verify it's unchanged
      const freshProviders = factory.getAllProviders();
      expect(freshProviders).toHaveLength(originalLength);
    });
  });

  describe("configuration integration", () => {
    it("should respect configuration changes", () => {
      // First call with tomtom config
      configService.get = vi.fn().mockReturnValue("tomtom");
      const result1 = factory.createProvider();
      expect(result1).toBe(tomtomProvider);

      // Change config and verify it's used
      configService.get = vi.fn().mockReturnValue("google");
      expect(() => factory.createProvider()).toThrow("Google Maps provider not implemented yet");
    });

    it("should handle missing configuration gracefully", () => {
      configService.get = vi.fn().mockReturnValue(null);

      const result = factory.createProvider();

      expect(result).toBe(tomtomProvider);
    });

    it("should handle empty string configuration", () => {
      configService.get = vi.fn().mockReturnValue("");

      // Empty string is falsy, so it should fall back to default "tomtom"
      const result = factory.createProvider();
      expect(result).toBe(tomtomProvider);
    });
  });

  describe("error handling", () => {
    it("should provide descriptive error messages", () => {
      const testCases = [
        { type: "google", expectedMessage: "Google Maps provider not implemented yet" },
        { type: "unknown", expectedMessage: "Unknown provider type: unknown" },
        { type: "bing", expectedMessage: "Unknown provider type: bing" },
      ];

      testCases.forEach(({ type, expectedMessage }) => {
        expect(() => factory.createProvider(type as ProviderType)).toThrow(expectedMessage);
      });
    });

    it("should handle config service errors gracefully", () => {
      configService.get = vi.fn().mockImplementation(() => {
        throw new Error("Config service error");
      });

      expect(() => factory.createProvider()).toThrow("Config service error");
    });
  });

  describe("type definitions", () => {
    it("should support ProviderType union correctly", () => {
      // This test ensures TypeScript compilation works correctly
      const validTypes: ProviderType[] = ["tomtom", "google"];
      
      validTypes.forEach(type => {
        if (type === "tomtom") {
          expect(factory.createProvider(type)).toBe(tomtomProvider);
        } else if (type === "google") {
          expect(() => factory.createProvider(type)).toThrow();
        }
      });
    });
  });

  describe("dependency injection", () => {
    it("should properly inject TomTom provider", () => {
      // Verify the injected provider is accessible
      const provider = factory.createProvider("tomtom");
      expect(provider).toBeDefined();
      expect(provider).toBe(tomtomProvider);
    });

    it("should properly inject ConfigService", () => {
      // Verify config service is being used
      configService.get = vi.fn().mockReturnValue("tomtom");
      
      factory.createProvider();
      
      expect(configService.get).toHaveBeenCalledWith(ConfigKey.DEFAULT_PROVIDER);
    });
  });
});