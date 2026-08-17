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
    // The `.iife.js` suffix comes from outExtension below, so the entry key is
    // the bare name — keying it "quickbugs.iife" produced quickbugs.iife.iife.js
    // and left the package's ./cdn export resolving to nothing.
    entry: { quickbugs: "src/iife.ts" },
    format: ["iife"],
    globalName: "QuickBugs",
    sourcemap: true,
    noExternal: ["@quick-bug-reporter/core"],
    treeshake: true,
    splitting: false,
    minify: true,
    outExtension({ format }) {
      if (format === "iife") return { js: ".iife.js" };
      return { js: ".js" };
    },
  },
]);