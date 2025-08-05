import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { dts } from "rollup-plugin-dts";
import { globSync } from "glob";

const baseOutput = {
  sourcemap: false,
  exports: "auto" as const,
};

const commonPlugins = [
  json(),
  resolve({
    preferBuiltins: false,
    browser: true,
    exportConditions: ["node", "default", "module", "import"],
    modulesOnly: true,
  }),
  commonjs(),
  typescript({
    tsconfig: "./tsconfig.json",
    sourceMap: false,
    declaration: false,
    declarationMap: false,
    tslib: "tslib",

    compilerOptions: {
      outDir: undefined,
    },
  }),
];

export default [
  {
    input: globSync("src/**/*.ts", {
      ignore: ["src/**/*.d.ts", "src/standalone.ts"],
    }),
    output: [
      {
        ...baseOutput,
        dir: "dist",
        format: "esm",
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
      },
      {
        ...baseOutput,
        dir: "dist",
        format: "cjs",
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].cjs",
        chunkFileNames: "[name].cjs",
      },
    ],
    plugins: commonPlugins,
    external: (id) => {
      return !id.startsWith(".") && !id.startsWith("/") && !id.includes("src/");
    },
  },
  {
    input: "src/standalone.ts",
    output: [
      {
        ...baseOutput,
        file: "dist/standalone.js",
        format: "esm",
      },
      {
        ...baseOutput,
        file: "dist/standalone.cjs",
        format: "cjs",
      },
    ],
    plugins: [
      json(),
      resolve({
        preferBuiltins: false,
        browser: false,
        exportConditions: ["node", "default", "module", "import"],
      }),
      commonjs({
        extensions: [".js", ".ts"],
      }),
      typescript({
        tsconfig: "./tsconfig.json",
        sourceMap: false,
        declaration: false,
        declarationMap: false,
        tslib: "tslib",
        compilerOptions: {
          outDir: undefined,
        },
      }),
    ],
    external: (id) => {
      return !id.startsWith(".") && !id.startsWith("/") && !id.includes("src/");
    },
    treeshake: {
      moduleSideEffects: false,
    },
  },
  {
    input: "src/index.ts",
    output: { file: "dist/index.d.ts", format: "esm" },
    plugins: [dts()],
  },
  {
    input: "src/standalone.ts",
    output: { file: "dist/standalone.d.ts", format: "esm" },
    plugins: [dts()],
  },
];
