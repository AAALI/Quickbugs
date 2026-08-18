import { describe, expect, it } from "vitest";

import { LIMITS, SCHEMA_VERSION } from "./contract";
import { isIngestError } from "./errors";
import { parseIngestForm, parseIngestRequest } from "./parse";

/** A form with the minimum a server will accept. */
function minimalForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("project_key", "pk_live_abcdefghij123456");
  form.set("title", "Checkout fails");

  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }

  return form;
}

/** Assert a call throws an IngestError with the given code. */
function expectRejection(fn: () => unknown, code: string, field?: string) {
  try {
    fn();
  } catch (error) {
    if (!isIngestError(error)) {
      throw error;
    }
    expect(error.code).toBe(code);
    if (field) {
      expect(error.field).toBe(field);
    }
    return error;
  }

  throw new Error(`Expected a ${code} rejection, but the call succeeded.`);
}

describe("parseIngestForm", () => {
  it("reads the environment out of the project key", () => {
    expect(parseIngestForm(minimalForm()).environment).toBe("live");
    expect(
      parseIngestForm(minimalForm({ project_key: "pk_test_abcdefghij123456" })).environment,
    ).toBe("test");
  });

  it("treats a legacy key as environment-unknown rather than rejecting it", () => {
    // Existing installs predate the pk_live_/pk_test_ format; refusing them
    // would break every current customer on upgrade.
    const parsed = parseIngestForm(minimalForm({ project_key: "legacy-key-123" }));

    expect(parsed.projectKey).toBe("legacy-key-123");
    expect(parsed.environment).toBeNull();
  });

  it("defaults the schema version when the client omits it", () => {
    expect(parseIngestForm(minimalForm()).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("accepts a newer minor version it can safely ignore fields from", () => {
    expect(parseIngestForm(minimalForm({ schema_version: "1.7" })).schemaVersion).toBe("1.7");
  });

  it("rejects a different major version", () => {
    expectRejection(
      () => parseIngestForm(minimalForm({ schema_version: "2.0" })),
      "unsupported_schema_version",
    );
  });

  it("requires a project key", () => {
    const form = new FormData();
    form.set("title", "Checkout fails");

    expectRejection(() => parseIngestForm(form), "missing_field", "project_key");
  });

  it("requires a title", () => {
    const form = new FormData();
    form.set("project_key", "pk_live_abcdefghij123456");

    expectRejection(() => parseIngestForm(form), "missing_field", "title");
  });

  it("rejects an over-long title", () => {
    expectRejection(
      () => parseIngestForm(minimalForm({ title: "x".repeat(LIMITS.maxTitleLength + 1) })),
      "field_too_long",
      "title",
    );
  });

  it("rejects an over-long text field", () => {
    expectRejection(
      () => parseIngestForm(minimalForm({ description: "x".repeat(LIMITS.maxFieldLength + 1) })),
      "field_too_long",
      "description",
    );
  });

  it("ignores fields the contract does not declare", () => {
    // An unknown field is dropped rather than rejected, so an older server
    // keeps working against a newer SDK.
    const parsed = parseIngestForm(minimalForm({ some_future_field: "value" }));

    expect(parsed.fields).not.toHaveProperty("some_future_field");
    expect(parsed.fields.title).toBe("Checkout fails");
  });

  it("rejects a text field sent as a file", () => {
    const form = minimalForm();
    form.set("description", new Blob(["x"], { type: "text/plain" }));

    expectRejection(() => parseIngestForm(form), "malformed_request", "description");
  });

  it("rejects an attachment sent as text", () => {
    const form = minimalForm();
    form.set("screenshot", "not-a-file");

    expectRejection(() => parseIngestForm(form), "malformed_request", "screenshot");
  });

  it("rejects an attachment with a disallowed content type", () => {
    const form = minimalForm();
    form.set("screenshot", new Blob(["<svg/>"], { type: "image/svg+xml" }));

    expectRejection(() => parseIngestForm(form), "unsupported_attachment_type", "screenshot");
  });

  it("rejects an attachment with no content type at all", () => {
    // Guessing would defeat the allow-list, which is a security boundary.
    const form = minimalForm();
    form.set("screenshot", new Blob(["data"]));

    expectRejection(() => parseIngestForm(form), "unsupported_attachment_type", "screenshot");
  });

  it("ignores content-type parameters when matching the allow-list", () => {
    const form = minimalForm();
    form.set("console_logs", new Blob(["log"], { type: "text/plain; charset=utf-8" }));

    expect(parseIngestForm(form).attachments).toHaveLength(1);
  });

  it("rejects an attachment over its own limit", () => {
    const form = minimalForm();
    const oversized = new Uint8Array(1 * 1024 * 1024 + 1);
    form.set("breadcrumbs", new Blob([oversized], { type: "application/json" }));

    expectRejection(() => parseIngestForm(form), "attachment_too_large", "breadcrumbs");
  });

  it("collects attachment sizes for quota accounting", () => {
    const form = minimalForm();
    form.set("screenshot", new Blob(["12345"], { type: "image/png" }));
    form.set("console_logs", new Blob(["123"], { type: "text/plain" }));

    const parsed = parseIngestForm(form);

    expect(parsed.totalAttachmentBytes).toBe(8);
    expect(parsed.attachments.map((a) => a.name).sort()).toEqual(["console_logs", "screenshot"]);
  });

  it("rejects an over-long client report id", () => {
    expectRejection(
      () => parseIngestForm(minimalForm({ client_report_id: "x".repeat(65) })),
      "field_too_long",
      "client_report_id",
    );
  });
});

describe("parseIngestRequest", () => {
  it("rejects a non-multipart body", async () => {
    const request = new Request("https://ingest.example.com/", {
      method: "POST",
      body: JSON.stringify({ title: "hi" }),
      headers: { "content-type": "application/json" },
    });

    await expect(parseIngestRequest(request)).rejects.toMatchObject({
      code: "invalid_content_type",
    });
  });

  it("parses a well-formed multipart request", async () => {
    const request = new Request("https://ingest.example.com/", {
      method: "POST",
      body: minimalForm(),
    });

    const parsed = await parseIngestRequest(request);

    expect(parsed.fields.title).toBe("Checkout fails");
  });
});
