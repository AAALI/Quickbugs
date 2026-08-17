import { describe, expect, it, vi } from "vitest";

import { REDACTED } from "../privacy";
import { bugReportPayload, recordingFetch } from "../testing/payload";
import { CloudIntegration } from "./cloud";

/** A successful ingest response, with optional forwarding details layered on. */
function ingestOk(extra: Record<string, unknown> = {}) {
  return recordingFetch({ id: "abcdef123456", created_at: "", ...extra });
}

/** The multipart body posted by the call under test. */
function formOf(sent: { init: RequestInit }[]): FormData {
  return sent[0].init.body as FormData;
}

describe("CloudIntegration", () => {
  it("requires a project key", () => {
    expect(() => new CloudIntegration({ projectKey: "" })).toThrow(/projectKey is required/);
  });

  it("posts the documented field names to the ingest endpoint", async () => {
    const { fetchImpl, sent } = ingestOk();
    const cloud = new CloudIntegration({ projectKey: "pk_test", fetchImpl });

    await cloud.submit(bugReportPayload());
    const form = formOf(sent);

    expect(form.get("project_key")).toBe("pk_test");
    expect(form.get("title")).toBe("Checkout fails on submit");
    expect(form.get("capture_mode")).toBe("screenshot");
    expect(form.get("provider")).toBe("cloud");
    expect(form.get("duration_ms")).toBe("5000");
  });

  it("sends structured reproduction fields when supplied", async () => {
    const { fetchImpl, sent } = ingestOk();
    const cloud = new CloudIntegration({ projectKey: "pk_test", fetchImpl });

    await cloud.submit(
      bugReportPayload({
        stepsToReproduce: "1. Open checkout\n2. Press Pay",
        expectedResult: "Order confirms",
        actualResult: "Nothing happens",
      }),
    );
    const form = formOf(sent);

    expect(form.get("steps_to_reproduce")).toContain("Press Pay");
    expect(form.get("expected_result")).toBe("Order confirms");
    expect(form.get("actual_result")).toBe("Nothing happens");
  });

  it("redacts credentials from the reported page URL", async () => {
    const { fetchImpl, sent } = ingestOk();
    const cloud = new CloudIntegration({ projectKey: "pk_test", fetchImpl });

    await cloud.submit(bugReportPayload({ pageUrl: "https://app.example.com/cb?access_token=sk_live_leak" }));

    const pageUrl = String(formOf(sent).get("page_url"));
    expect(pageUrl).not.toContain("sk_live_leak");
    // The marker arrives percent-encoded, as any query value would.
    expect(pageUrl).toContain(encodeURIComponent(REDACTED));
  });

  it("attaches screenshot and video blobs when present", async () => {
    const { fetchImpl, sent } = ingestOk();
    const cloud = new CloudIntegration({ projectKey: "pk_test", fetchImpl });

    await cloud.submit(
      bugReportPayload({
        screenshotBlob: new Blob(["png"], { type: "image/png" }),
        videoBlob: new Blob(["webm"], { type: "video/webm" }),
      }),
    );
    const form = formOf(sent);

    expect(form.get("screenshot")).toBeInstanceOf(Blob);
    expect(form.get("video")).toBeInstanceOf(Blob);
    expect(form.get("has_screenshot")).toBe("true");
    expect(form.get("has_video")).toBe("true");
  });

  it("resolves custom metadata hooks at submit time", async () => {
    const { fetchImpl, sent } = ingestOk();
    const cloud = new CloudIntegration({
      projectKey: "pk_test",
      fetchImpl,
      metadata: { plan: () => "enterprise" },
    });

    await cloud.submit(bugReportPayload());

    expect(JSON.parse(String(formOf(sent).get("custom_metadata")))).toMatchObject({
      plan: "enterprise",
    });
  });

  it("reports a queued tracker hand-off as a warning, not a failure", async () => {
    const { fetchImpl } = ingestOk({ forwarding_status: "queued" });
    const cloud = new CloudIntegration({ projectKey: "pk_test", fetchImpl });

    const result = await cloud.submit(bugReportPayload());

    expect(result.warnings).toContain("Tracker forwarding is running in the background.");
    expect(result.issueId).toBe("abcdef123456");
  });

  it("prefers the real tracker key and URL once forwarding completes", async () => {
    const { fetchImpl } = ingestOk({
      forwarding_status: "completed",
      forwarding: { provider: "linear", key: "ENG-42", url: "https://linear.app/i/ENG-42" },
    });
    const cloud = new CloudIntegration({ projectKey: "pk_test", fetchImpl });

    const result = await cloud.submit(bugReportPayload());

    expect(result.issueKey).toBe("ENG-42");
    expect(result.issueUrl).toBe("https://linear.app/i/ENG-42");
  });

  it("surfaces the server's error message on failure", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "Invalid project key" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    ) as unknown as typeof fetch;

    const cloud = new CloudIntegration({ projectKey: "pk_bad", fetchImpl });

    await expect(cloud.submit(bugReportPayload())).rejects.toThrow(/Invalid project key/);
  });

  it("reports progress through the submission", async () => {
    const { fetchImpl } = ingestOk();
    const cloud = new CloudIntegration({ projectKey: "pk_test", fetchImpl });
    const onProgress = vi.fn();

    await cloud.submit(bugReportPayload(), onProgress);

    expect(onProgress).toHaveBeenCalledWith("Preparing report…");
    expect(onProgress).toHaveBeenCalledWith("Report submitted.");
  });
});
