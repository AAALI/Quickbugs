import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["vue"],
  noExternal: ["@quick-bug-reporter/core"],
  treeshake: true,
  splitting: false,
});
