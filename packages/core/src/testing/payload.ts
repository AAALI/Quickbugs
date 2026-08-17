/**
 * Shared test fixtures.
 *
 * Not exported from the package entry point, so it is never bundled into a
 * published artifact. It lives in `src` only so it is type-checked alongside
 * the code it describes — a payload shape that drifts should fail typecheck,
 * not just tests.
 */

import type { BugReportPayload } from "../types";

/**
 * A minimal valid report. Tests override only the fields they assert on, so a
 * new required field surfaces here once rather than in every suite.
 */
export function bugReportPayload(overrides: Partial<BugReportPayload> = {}): BugReportPayload {
  return {
    title: "Checkout fails on submit",
    description: "Pressing Pay does nothing.",
    videoBlob: null,
    screenshotBlob: null,
    networkLogs: [],
    consoleLogs: [],
    jsErrors: [],
    captureMode: "screenshot",
    pageUrl: "https://app.example.com/checkout",
    userAgent: "Mozilla/5.0 (Macintosh) Chrome/120.0.0.0",
    startedAt: "2026-08-17T10:00:00.000Z",
    stoppedAt: "2026-08-17T10:00:05.000Z",
    elapsedMs: 5000,
    metadata: {
      locale: "en-AE",
      timezone: "Asia/Dubai",
      language: "en-AE",
      languages: ["en-AE"],
      platform: "MacIntel",
      referrer: null,
      colorScheme: "dark",
      viewport: { width: 1440, height: 900, pixelRatio: 2 },
      screen: { width: 1440, height: 900, availWidth: 1440, availHeight: 860, colorDepth: 24 },
      device: {
        hardwareConcurrency: 8,
        deviceMemoryGb: 16,
        maxTouchPoints: 0,
        online: true,
        cookieEnabled: true,
      },
      connection: { effectiveType: "4g", downlinkMbps: 10, rttMs: 50, saveData: false },
      captureMode: "screenshot",
      capture: {
        startedAt: "2026-08-17T10:00:00.000Z",
        stoppedAt: "2026-08-17T10:00:05.000Z",
        elapsedMs: 5000,
      },
    },
    ...overrides,
  };
}

/** A `fetch` double that records what was sent and replies with `body`. */
export function recordingFetch(body: unknown = {}, status = 200) {
  const sent: { url: string; init: RequestInit }[] = [];

  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  return { fetchImpl, sent };
}
