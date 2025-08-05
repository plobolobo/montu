import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "fs";
import { join } from "path";

describe("Distribution Import Tests", () => {
  const distPath = join(process.cwd(), "dist");
  const mainLibPath = join(distPath, "index.cjs");
  const standalonePath = join(distPath, "standalone.cjs");

  beforeAll(() => {
    // Ensure dist files exist before running tests
    if (!existsSync(distPath)) {
      throw new Error(
        'Distribution files not found. Please run "npm run build" first.'
      );
    }
    if (!existsSync(mainLibPath)) {
      throw new Error(
        "Main library distribution file not found: dist/index.cjs"
      );
    }
    if (!existsSync(standalonePath)) {
      throw new Error(
        "Standalone distribution file not found: dist/standalone.cjs"
      );
    }
  });

  describe("Main Library Import", () => {
    it("should successfully import the main library", async () => {
      // Dynamic import to avoid TypeScript issues with require in tests
      const lib = await import("../../dist/index.cjs");
      expect(lib).toBeDefined();
      expect(typeof lib).toBe("object");
    });

    it("should export required services and schemas", async () => {
      const lib = await import("../../dist/index.cjs");

      // Test essential exports
      expect(lib.QuickrouteAddressParserService).toBeDefined();
      expect(lib.AddressParserConfigSchema).toBeDefined();
      expect(lib.QuickrouteAddressParserModule).toBeDefined();

      // Test provider exports
      expect(lib.TomTomAddressProvider).toBeDefined();
      expect(lib.GoogleAddressProvider).toBeDefined();
      expect(lib.AddressProviderFactory).toBeDefined();

      // Test other essential exports
      expect(lib.BaseHttpService).toBeDefined();
      expect(lib.ErrorLoggingService).toBeDefined();
    });

    it("should have a reasonable number of exports", async () => {
      const lib = await import("../../dist/index.cjs");
      const exportKeys = Object.keys(lib);

      // Should have at least 10 exports but not be overwhelming
      expect(exportKeys.length).toBeGreaterThan(10);
      expect(exportKeys.length).toBeLessThan(100);
    });

    it("should export the module with required API key configuration", async () => {
      const { QuickrouteAddressParserModule } = await import(
        "../../dist/index.cjs"
      );

      expect(QuickrouteAddressParserModule).toBeDefined();
      expect(typeof QuickrouteAddressParserModule.register).toBe("function");

      // Test that the module can be registered with required config
      expect(() => {
        QuickrouteAddressParserModule.register({
          apiKey: "test-api-key",
          isGlobal: true,
        });
      }).not.toThrow();
    });
  });

  describe("Standalone Import", () => {
    it("should successfully import the standalone class", async () => {
      const QuickrouteAddressParser = await import("../../dist/standalone.cjs");
      expect(QuickrouteAddressParser).toBeDefined();
    });

    it("should import as a constructor function", async () => {
      const standaloneModule = await import("../../dist/standalone.cjs");
      const QuickrouteAddressParser = standaloneModule.default;

      expect(typeof QuickrouteAddressParser).toBe("function");
      expect(QuickrouteAddressParser.name).toBe("QuickrouteAddressParser");
    });

    it("should create an instance with required config", async () => {
      const standaloneModule = await import("../../dist/standalone.cjs");
      const QuickrouteAddressParser = standaloneModule.default;

      const parser = new QuickrouteAddressParser({
        apiKey: "test-api-key",
        baseUrl: "https://api.tomtom.com",
        enableLogging: false,
      });

      expect(parser).toBeDefined();
      expect(parser).toBeInstanceOf(QuickrouteAddressParser);
    });

    it("should create instance even without apiKey but fail on initialization", async () => {
      const standaloneModule = await import("../../dist/standalone.cjs");
      const QuickrouteAddressParser = standaloneModule.default;

      // Constructor should not throw (validation happens during initialization)
      const parser = new QuickrouteAddressParser({
        baseUrl: "https://api.tomtom.com",
        enableLogging: false,
      } as any); // Type assertion to bypass TS checking for this test

      expect(parser).toBeDefined();
      expect(parser).toBeInstanceOf(QuickrouteAddressParser);

      // However, calling a method that triggers initialization should fail
      await expect(parser.searchAddresses("test query")).rejects.toThrow();
    });
  });

  describe("Config-Only Approach Validation", () => {
    it("should work without any environment variables", async () => {
      // Clear any potential environment variables
      delete process.env.TOMTOM_API_KEY;
      delete process.env.BASE_URL;

      const standaloneModule = await import("../../dist/standalone.cjs");
      const QuickrouteAddressParser = standaloneModule.default;

      // Should work with config only
      expect(() => {
        new QuickrouteAddressParser({
          apiKey: "test-api-key-from-config",
          baseUrl: "https://api.tomtom.com",
          enableLogging: false,
        });
      }).not.toThrow();
    });

    it("should validate API key is provided through config for main module", async () => {
      // Clear environment variables
      delete process.env.TOMTOM_API_KEY;

      const { QuickrouteAddressParserModule } = await import(
        "../../dist/index.cjs"
      );

      // Should work when API key is provided through options
      expect(() => {
        QuickrouteAddressParserModule.register({
          apiKey: "test-api-key-from-config",
          isGlobal: true,
        });
      }).not.toThrow();
    });
  });

  describe("File Structure Validation", () => {
    it("should have required distribution files", () => {
      expect(existsSync(join(distPath, "index.cjs"))).toBe(true);
      expect(existsSync(join(distPath, "index.js"))).toBe(true);
      expect(existsSync(join(distPath, "index.d.ts"))).toBe(true);
      expect(existsSync(join(distPath, "standalone.cjs"))).toBe(true);
      expect(existsSync(join(distPath, "standalone.js"))).toBe(true);
      expect(existsSync(join(distPath, "standalone.d.ts"))).toBe(true);
    });

    it("should have modular structure with preserved modules", () => {
      // Check for some key module files
      expect(existsSync(join(distPath, "config"))).toBe(true);
      expect(existsSync(join(distPath, "services"))).toBe(true);
      expect(existsSync(join(distPath, "providers"))).toBe(true);
      expect(existsSync(join(distPath, "dto"))).toBe(true);
    });
  });
});
