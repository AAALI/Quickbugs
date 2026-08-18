import { describe, expect, it, vi } from "vitest";

import {
  type CreateReportInput,
  type IngestStore,
  type ProjectRecord,
  type PutAttachmentInput,
  createIngestHandler,
} from "./handler";

/**
 * In-memory store. The handler's whole contract with the outside world is this
 * interface, so exercising it here covers the real path a Supabase or
 * self-hosted adapter takes — only the storage calls differ.
 */
class FakeStore implements IngestStore {
  readonly reports: (CreateReportInput & { id: string; createdAt: string })[] = [];
  readonly attachments: PutAttachmentInput[] = [];
  putAttachmentImpl?: () => Promise<void>;

  constructor(private readonly projects: Record<string, ProjectRecord> = {}) {}

  async findProjectByKey(projectKey: string): Promise<ProjectRecord | null> {
    return this.projects[projectKey] ?? null;
  }

  async findReportByClientId(projectId: string, clientReportId: string) {
    const found = this.reports.find(
      (r) => r.projectId === projectId && r.clientReportId === clientReportId,
    );
    return found ? { id: found.id, createdAt: found.createdAt } : null;
  }

  async createReport(input: CreateReportInput) {
    const record = {
      ...input,
      id: `rep_${this.reports.length + 1}`,
      createdAt: "2026-08-18T00:00:00.000Z",
    };
    this.reports.push(record);
    return { id: record.id, createdAt: record.createdAt };
  }

  async putAttachment(input: PutAttachmentInput): Promise<void> {
    if (this.putAttachmentImpl) {
      await this.putAttachmentImpl();
    }
    this.attachments.push(input);
  }
}

const LIVE_KEY = "pk_live_abcdefghij123456";

function storeWithProject(overrides: Partial<ProjectRecord> = {}): FakeStore {
  return new FakeStore({
    [LIVE_KEY]: { id: "proj_1", allowedOrigins: [], active: true, ...overrides },
  });
}

function reportRequest(
  fields: Record<string, string> = {},
  init: { origin?: string; attachments?: Record<string, Blob> } = {},
): Request {
  const form = new FormData();
  form.set("project_key", LIVE_KEY);
  form.set("title", "Checkout fails");

  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  for (const [key, blob] of Object.entries(init.attachments ?? {})) {
    form.set(key, blob);
  }

  return new Request("https://ingest.example.com/", {
    method: "POST",
    body: form,
    headers: init.origin ? { origin: init.origin } : undefined,
  });
}

describe("createIngestHandler", () => {
  it("stores a valid report and returns its identity", async () => {
    const store = storeWithProject();
    const handler = createIngestHandler({ store, appBaseUrl: "https://app.quickbugs.com" });

    const response = await handler(reportRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe("rep_1");
    expect(body.url).toBe("https://app.quickbugs.com/reports/rep_1");
    expect(store.reports).toHaveLength(1);
    expect(store.reports[0].fields.title).toBe("Checkout fails");
  });

  it("returns a null url when no app base is configured", async () => {
    const handler = createIngestHandler({ store: storeWithProject() });

    const body = await (await handler(reportRequest())).json();

    expect(body.url).toBeNull();
  });

  it("stores each attachment against the report", async () => {
    const store = storeWithProject();
    const handler = createIngestHandler({ store });

    await handler(
      reportRequest({}, {
        attachments: {
          screenshot: new Blob(["png"], { type: "image/png" }),
          console_logs: new Blob(["log"], { type: "text/plain" }),
        },
      }),
    );

    expect(store.attachments.map((a) => a.attachment.name).sort()).toEqual([
      "console_logs",
      "screenshot",
    ]);
    expect(store.attachments.every((a) => a.reportId === "rep_1")).toBe(true);
  });

  it("rejects an unknown project key without revealing whether it ever existed", async () => {
    const handler = createIngestHandler({ store: new FakeStore() });

    const response = await handler(reportRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("invalid_project_key");
    expect(body.error.retryable).toBe(false);
  });

  it("rejects a revoked key exactly as it rejects an unknown one", async () => {
    // Distinguishing the two would turn this endpoint into a key-validity oracle.
    const handler = createIngestHandler({ store: storeWithProject({ active: false }) });

    const body = await (await handler(reportRequest())).json();

    expect(body.error.code).toBe("invalid_project_key");
  });

  it("rejects an origin outside the project's allow-list", async () => {
    const store = storeWithProject({ allowedOrigins: ["https://app.example.com"] });
    const handler = createIngestHandler({ store });

    const response = await handler(reportRequest({}, { origin: "https://evil.test" }));

    expect(response.status).toBe(403);
    expect(store.reports).toHaveLength(0);
  });

  it("accepts an allow-listed origin and echoes it back", async () => {
    const store = storeWithProject({ allowedOrigins: ["https://app.example.com"] });
    const handler = createIngestHandler({ store });

    const response = await handler(reportRequest({}, { origin: "https://app.example.com" }));

    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
  });

  it("returns the original report when a submission is retried", async () => {
    const store = storeWithProject();
    const handler = createIngestHandler({ store });
    const fields = { client_report_id: "6f1c2e3a-0000-4000-8000-000000000001" };

    const first = await handler(reportRequest(fields));
    const second = await handler(reportRequest(fields));

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await first.json()).id).toBe((await second.json()).id);
    // The point of the whole mechanism: one capture, one report.
    expect(store.reports).toHaveLength(1);
  });

  it("treats submissions without a client id as distinct reports", async () => {
    const store = storeWithProject();
    const handler = createIngestHandler({ store });

    await handler(reportRequest());
    await handler(reportRequest());

    expect(store.reports).toHaveLength(2);
  });

  it("answers CORS preflight without touching the store", async () => {
    const store = storeWithProject();
    const handler = createIngestHandler({ store });

    const response = await handler(
      new Request("https://ingest.example.com/", {
        method: "OPTIONS",
        headers: { origin: "https://app.example.com" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
    expect(store.reports).toHaveLength(0);
  });

  it("rejects a non-POST method", async () => {
    const handler = createIngestHandler({ store: storeWithProject() });

    const response = await handler(new Request("https://ingest.example.com/", { method: "GET" }));

    expect(response.status).toBe(405);
  });

  it("reports a storage failure as retryable", async () => {
    const store = storeWithProject();
    store.putAttachmentImpl = async () => {
      throw new Error("bucket unavailable");
    };
    const handler = createIngestHandler({ store });

    const response = await handler(
      reportRequest({}, { attachments: { screenshot: new Blob(["png"], { type: "image/png" }) } }),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error.retryable).toBe(true);
  });

  it("notifies once a report is stored", async () => {
    const onReportCreated = vi.fn();
    const handler = createIngestHandler({
      store: storeWithProject(),
      appBaseUrl: "https://app.quickbugs.com",
      onReportCreated,
    });

    await handler(reportRequest());

    expect(onReportCreated).toHaveBeenCalledWith(
      expect.objectContaining({ reportId: "rep_1", title: "Checkout fails" }),
    );
  });

  it("keeps the report when notification fails", async () => {
    // A broken Slack webhook must not cost the customer a bug report.
    const store = storeWithProject();
    const handler = createIngestHandler({
      store,
      onReportCreated: () => {
        throw new Error("webhook down");
      },
    });

    const response = await handler(reportRequest());

    expect(response.status).toBe(201);
    expect(store.reports).toHaveLength(1);
  });

  it("returns a generic error when the store fails unexpectedly", async () => {
    const store = storeWithProject();
    store.createReport = async () => {
      throw new Error("connection reset");
    };
    const handler = createIngestHandler({ store });

    const response = await handler(reportRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("internal_error");
    // The underlying message must not leak to a public endpoint.
    expect(JSON.stringify(body)).not.toContain("connection reset");
  });
});
