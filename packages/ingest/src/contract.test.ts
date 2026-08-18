/**
 * SDK ↔ server agreement.
 *
 * These tests drive the real `CloudIntegration` and parse whatever it actually
 * posts. Nothing here is hand-written form data, because a hand-written fixture
 * only proves the parser agrees with the fixture. If someone adds a field to the
 * SDK without adding it to the contract, this file fails.
 */

import { CloudIntegration, REPORT_SCHEMA_VERSION, type BugReportPayload } from "@quick-bug-reporter/core";
import { describe, expect, it } from "vitest";

import { CONTEXT_FIELDS, REPORTER_FIELDS, REPORT_FIELDS, SCHEMA_VERSION } from "./contract";
import { parseIngestForm } from "./parse";

/** Capture the multipart body the SDK posts, without a network round trip. */
async function capturePostedForm(
  payload: Partial<BugReportPayload> = {},
  options: { projectKey?: string } = {},
): Promise<FormData> {
  let captured: FormData | undefined;

  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    captured = init!.body as FormData;
    return new Response(JSON.stringify({ id: "rep_1", created_at: "2026-08-18T00:00:00.000Z" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  const cloud = new CloudIntegration({ projectKey: options.projectKey ?? "pk_test_abcdefghij123456", fetchImpl });
  await cloud.submit(fullPayload(payload));

  if (!captured) {
    throw new Error("CloudIntegration did not post a body");
  }

  return captured;
}

function fullPayload(overrides: Partial<BugReportPayload> = {}): BugReportPayload {
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
    startedAt: "2026-08-18T10:00:00.000Z",
    stoppedAt: "2026-08-18T10:00:05.000Z",
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
        startedAt: "2026-08-18T10:00:00.000Z",
        stoppedAt: "2026-08-18T10:00:05.000Z",
        elapsedMs: 5000,
      },
    },
    ...overrides,
  };
}

describe("schema version", () => {
  it("matches the constant the SDK ships", () => {
    // Kept as two constants so the browser bundle carries no server code.
    // If this fails, one side was bumped without the other.
    expect(SCHEMA_VERSION).toBe(REPORT_SCHEMA_VERSION);
  });
});

describe("SDK payload parses against the contract", () => {
  it("accepts a minimal report", async () => {
    const form = await capturePostedForm();

    const parsed = parseIngestForm(form);

    expect(parsed.projectKey).toBe("pk_test_abcdefghij123456");
    expect(parsed.environment).toBe("test");
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.fields.title).toBe("Checkout fails on submit");
  });

  it("declares every field the SDK actually sends", async () => {
    // The real guard: enumerate the posted form and assert the contract knows
    // each key. A field added to CloudIntegration but not to contract.ts would
    // be silently dropped by the parser and lost from the report.
    const form = await capturePostedForm({
      stepsToReproduce: "1. Open checkout",
      expectedResult: "Order confirms",
      actualResult: "Nothing happens",
      additionalContext: "Only on Safari",
      user: { id: "u_1", email: "ali@example.com", name: "Ali" },
      breadcrumbs: [{ type: "click", timestamp: "2026-08-18T10:00:01.000Z", element: "button" }],
      screenshotBlob: new Blob(["png"], { type: "image/png" }),
      videoBlob: new Blob(["webm"], { type: "video/webm" }),
      captureHasMic: true,
    });

    const known = new Set<string>([
      "project_key",
      "schema_version",
      "client_report_id",
      ...REPORT_FIELDS,
      ...CONTEXT_FIELDS,
      ...REPORTER_FIELDS,
      // Attachments, validated separately.
      "screenshot",
      "video",
      "network_logs",
      "console_logs",
      "breadcrumbs",
      "metadata",
    ]);

    const undeclared = [...form.keys()].filter((key) => !known.has(key));

    expect(undeclared).toEqual([]);
  });

  it("preserves the structured reproduction fields end to end", async () => {
    const form = await capturePostedForm({
      stepsToReproduce: "1. Open checkout\n2. Press Pay",
      expectedResult: "Order confirms",
      actualResult: "Nothing happens",
    });

    const parsed = parseIngestForm(form);

    expect(parsed.fields.steps_to_reproduce).toContain("Press Pay");
    expect(parsed.fields.expected_result).toBe("Order confirms");
    expect(parsed.fields.actual_result).toBe("Nothing happens");
  });

  it("accepts every attachment the SDK can produce", async () => {
    const form = await capturePostedForm({
      screenshotBlob: new Blob(["png"], { type: "image/png" }),
      videoBlob: new Blob(["webm"], { type: "video/webm" }),
      breadcrumbs: [{ type: "navigation", timestamp: "2026-08-18T10:00:01.000Z", url: "/checkout" }],
    });

    const parsed = parseIngestForm(form);
    const names = parsed.attachments.map((a) => a.name).sort();

    expect(names).toEqual(["breadcrumbs", "console_logs", "metadata", "network_logs", "screenshot", "video"]);
  });

  it("carries a client report id so retries are idempotent", async () => {
    const form = await capturePostedForm({ clientReportId: "6f1c2e3a-0000-4000-8000-000000000001" });

    const parsed = parseIngestForm(form);

    expect(parsed.clientReportId).toBe("6f1c2e3a-0000-4000-8000-000000000001");
  });

  it("drops empty context values rather than storing blanks", async () => {
    const form = await capturePostedForm();

    const parsed = parseIngestForm(form);

    // The SDK sends "" for anything it could not determine.
    expect(Object.values(parsed.fields)).not.toContain("");
  });
});
