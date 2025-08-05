import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        parser: {
          syntax: "typescript",
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    setupFiles: [],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "__tests__/",
        "**/__tests__/**",
        "examples/",
        "**/examples/**",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/providers/google/**",
        "**/.eslintrc.*",
        "**/*.module.ts",
      ],
    },
  },
  define: {
    global: "globalThis",
  },
});
