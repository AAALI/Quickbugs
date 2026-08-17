import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The SDK only ever runs in a browser; every unit under test touches
    // `window`, `document`, or a browser global.
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["packages/*/src/**/*.test.ts"],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
      reporter: ["text", "lcov"],
      // Capture and redaction are the paths that lose data or leak
      // credentials when they regress, so they carry a real floor.
      thresholds: {
        "packages/core/src/privacy.ts": { statements: 90, branches: 85, functions: 90, lines: 90 },
      },
    },
  },
});
