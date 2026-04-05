import { defineConfig } from "tsup";

export default defineConfig([
  // ESM + CJS for npm consumers
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    noExternal: ["@quick-bug-reporter/core"],
    treeshake: true,
    splitting: false,
  },
  // IIFE for CDN / script tag usage — exposes window.QuickBugs
  {
    entry: { "quickbugs.iife": "src/iife.ts" },
    format: ["iife"],
    globalName: "QuickBugs",
    sourcemap: true,
    noExternal: ["@quick-bug-reporter/core"],
    treeshake: true,
    splitting: false,
    minify: true,
  },
]);
