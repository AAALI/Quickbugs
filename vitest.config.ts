import { defineConfig } from "vitest/config";

/**
 * Two test environments, because the repo holds two kinds of code.
 *
 * The SDK runs in a browser and needs jsdom. The ingest package runs on a
 * server and must be tested against real platform `Request`/`FormData` —
 * jsdom's multipart implementation cannot parse a body containing Blob parts,
 * which is exactly what a report is.
 */
export default defineConfig({
  test: {
    restoreMocks: true,
    unstubGlobals: true,
    projects: [
      {
        test: {
          name: "sdk",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: [
            "packages/core/src/**/*.test.ts",
            "packages/react/src/**/*.test.ts",
            "packages/vue/src/**/*.test.ts",
            "packages/vanilla/src/**/*.test.ts",
          ],
          restoreMocks: true,
          unstubGlobals: true,
        },
      },
      {
        test: {
          name: "server",
          environment: "node",
          include: ["packages/ingest/src/**/*.test.ts"],
          restoreMocks: true,
          unstubGlobals: true,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts", "**/testing/**"],
      reporter: ["text", "lcov"],
      // Privacy and ingest are the paths that leak credentials or lose reports
      // when they regress, so they carry a real floor.
      thresholds: {
        "packages/core/src/privacy.ts": { statements: 90, branches: 85, functions: 90, lines: 90 },
        "packages/ingest/src/parse.ts": { statements: 90, branches: 85, functions: 90, lines: 90 },
        "packages/ingest/src/handler.ts": { statements: 90, branches: 80, functions: 90, lines: 90 },
        "packages/ingest/src/origins.ts": { statements: 90, branches: 85, functions: 90, lines: 90 },
      },
    },
  },
});
