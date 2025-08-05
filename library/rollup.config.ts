import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { dts } from "rollup-plugin-dts";
import autoExternal from "rollup-plugin-auto-external";
import type { RollupOptions } from "rollup";

import { PROVIDER_NAMES } from "./src/constants";

const PROVIDER_NAMES_ARR = Object.values(PROVIDER_NAMES);

const baseOutput = {
  sourcemap: false,
  exports: "auto" as const,
};

const commonPlugins = [
  autoExternal(),
  json(),
  resolve({
    preferBuiltins: true,
  }),
  commonjs(),
  typescript({
    tsconfig: "./tsconfig.json",
    sourceMap: false,
    declaration: false,
    declarationMap: false,
    tslib: "tslib",
  }),
];

const buildProviders = (providerNames: string[]): RollupOptions[] => {
  return providerNames.map((providerName) => ({
    input: `src/providers/${providerName}/index.ts`,
    output: [
      {
        ...baseOutput,
        file: `dist/providers/${providerName}.js`,
        format: "esm",
      },
      {
        ...baseOutput,
        file: `dist/providers/${providerName}.cjs`,
        format: "cjs",
      },
    ],
    plugins: commonPlugins,
  }));
};

const providerConfigs = buildProviders(PROVIDER_NAMES_ARR);

export default [
  ...providerConfigs,
  {
    input: "src/index.ts",
    output: [
      { ...baseOutput, file: "dist/index.js", format: "esm" },
      { ...baseOutput, file: "dist/index.cjs", format: "cjs" },
    ],
    plugins: commonPlugins,
  },
  {
    input: "src/standalone.ts",
    output: [
      { ...baseOutput, file: "dist/standalone.js", format: "esm" },
      { ...baseOutput, file: "dist/standalone.cjs", format: "cjs" },
    ],
    plugins: commonPlugins,
  },
  {
    input: "src/index.ts",
    output: { file: "dist/index.d.ts", format: "esm" },
    plugins: [dts()],
  },
  {
    input: "src/standalone.d.ts",
    output: { file: "dist/standalone.d.ts", format: "esm" },
    plugins: [dts()],
  },
];
