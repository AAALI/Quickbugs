/**
 * The ingest request handler.
 *
 * Storage is injected rather than imported, which is what lets one
 * implementation serve both QuickBugs Cloud and a customer's self-hosted
 * deployment. It also means the whole accept-a-report path is testable with
 * in-memory fakes, with no database or object store in the loop.
 */

import { SCHEMA_VERSION } from "./contract";
import { IngestError, isIngestError } from "./errors";
import { assertOriginAllowed, corsHeaders } from "./origins";
import { type ParsedAttachment, type ParsedReport, parseIngestRequest } from "./parse";

/** A project, as the store knows it. */
export type ProjectRecord = {
  id: string;
  /** Empty means "accept any origin" — see assertOriginAllowed. */
  allowedOrigins: string[];
  /** Whether this key may still be used. Rotated keys stay resolvable but inert. */
  active: boolean;
};

export type CreateReportInput = {
  projectId: string;
  clientReportId: string | null;
  schemaVersion: string;
  fields: Record<string, string>;
  receivedAt: string;
};

export type PutAttachmentInput = {
  projectId: string;
  reportId: string;
  attachment: ParsedAttachment;
};

/**
 * Everything the handler needs from the outside world.
 *
 * Implementations must make `findReportByClientId` and `createReport`
 * consistent with each other — the idempotency guarantee is only as strong as
 * the store's uniqueness constraint, so the SQL schema carries a unique index
 * rather than relying on this read-then-write alone.
 */
export interface IngestStore {
  findProjectByKey(projectKey: string): Promise<ProjectRecord | null>;
  findReportByClientId(projectId: string, clientReportId: string): Promise<{ id: string; createdAt: string } | null>;
  createReport(input: CreateReportInput): Promise<{ id: string; createdAt: string }>;
  putAttachment(input: PutAttachmentInput): Promise<void>;
}

export type IngestHandlerOptions = {
  store: IngestStore;
  /** Absolute base for report URLs, e.g. `https://app.quickbugs.com`. */
  appBaseUrl?: string;
  /** Called once a report is durably stored. Failures here never fail the request. */
  onReportCreated?: (event: ReportCreatedEvent) => void | Promise<void>;
  /** Injectable for deterministic tests. */
  now?: () => Date;
};

export type ReportCreatedEvent = {
  reportId: string;
  projectId: string;
  title: string;
  reportUrl: string | null;
  attachmentCount: number;
};

/** The success body. Matches what the SDK's CloudIntegration expects back. */
export type IngestSuccessBody = {
  id: string;
  created_at: string;
  url: string | null;
  schema_version: string;
  /**
   * Tracker delivery runs after the response so a slow Jira cannot make the
   * reporter wait. `queued` tells the SDK to describe it as in progress.
   */
  forwarding_status: "queued" | "none";
};

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "content-type": "application/json" },
  });
}

/**
 * Store every attachment, cleaning up nothing on partial failure.
 *
 * A report with three of four attachments is worth far more than no report at
 * all, so a storage failure is surfaced rather than rolled back — the record
 * already names what it expected, and the inbox can show the gap.
 */
async function storeAttachments(
  store: IngestStore,
  projectId: string,
  reportId: string,
  attachments: ParsedAttachment[],
): Promise<void> {
  for (const attachment of attachments) {
    try {
      await store.putAttachment({ projectId, reportId, attachment });
    } catch {
      throw new IngestError(
        "storage_failed",
        `Stored the report but could not store attachment "${attachment.name}". Retry the submission.`,
        attachment.name,
      );
    }
  }
}

/**
 * Build the ingest handler.
 *
 * @returns A `fetch`-style handler: `(Request) => Promise<Response>`, which is
 * the shape Supabase Edge, Cloudflare Workers, Deno, and Node 18+ all accept.
 */
export function createIngestHandler(options: IngestHandlerOptions) {
  const { store, appBaseUrl, onReportCreated, now = () => new Date() } = options;

  const reportUrlFor = (id: string): string | null =>
    appBaseUrl ? `${appBaseUrl.replace(/\/$/, "")}/reports/${id}` : null;

  return async function handleIngest(request: Request): Promise<Response> {
    const origin = request.headers.get("origin");

    // Preflight is answered before any parsing — the browser sends it with no
    // body and no project key.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, []) });
    }

    if (request.method !== "POST") {
      return jsonResponse(
        new IngestError("malformed_request", "Reports must be submitted with POST.").toBody(),
        405,
        corsHeaders(origin, []),
      );
    }

    let parsed: ParsedReport | undefined;

    try {
      parsed = await parseIngestRequest(request);

      const project = await store.findProjectByKey(parsed.projectKey);

      if (!project || !project.active) {
        // Deliberately identical for unknown and revoked keys: distinguishing
        // them turns this endpoint into a key-validity oracle.
        throw new IngestError(
          "invalid_project_key",
          "Unrecognised project key. Check the key in your project settings.",
          "project_key",
        );
      }

      assertOriginAllowed(origin, project.allowedOrigins);

      const cors = corsHeaders(origin, project.allowedOrigins);
      const receivedAt = now().toISOString();

      // Idempotency: a client retrying after a timeout sends the same id, and
      // must get the original report back rather than create a duplicate.
      if (parsed.clientReportId) {
        const existing = await store.findReportByClientId(project.id, parsed.clientReportId);

        if (existing) {
          return jsonResponse(
            {
              id: existing.id,
              created_at: existing.createdAt,
              url: reportUrlFor(existing.id),
              schema_version: SCHEMA_VERSION,
              forwarding_status: "queued",
            } satisfies IngestSuccessBody,
            200,
            cors,
          );
        }
      }

      const created = await store.createReport({
        projectId: project.id,
        clientReportId: parsed.clientReportId,
        schemaVersion: parsed.schemaVersion,
        fields: parsed.fields,
        receivedAt,
      });

      await storeAttachments(store, project.id, created.id, parsed.attachments);

      // The report is safe at this point. A failing notification must not turn
      // a stored report into an error the client will retry.
      try {
        await onReportCreated?.({
          reportId: created.id,
          projectId: project.id,
          title: parsed.fields.title ?? "Untitled report",
          reportUrl: reportUrlFor(created.id),
          attachmentCount: parsed.attachments.length,
        });
      } catch {
        // Intentionally swallowed; delivery is observable server-side.
      }

      return jsonResponse(
        {
          id: created.id,
          created_at: created.createdAt,
          url: reportUrlFor(created.id),
          schema_version: SCHEMA_VERSION,
          forwarding_status: "queued",
        } satisfies IngestSuccessBody,
        201,
        cors,
      );
    } catch (error) {
      const cors = corsHeaders(origin, []);

      if (isIngestError(error)) {
        return jsonResponse(error.toBody(), error.status, cors);
      }

      const unexpected = new IngestError(
        "internal_error",
        "The report could not be processed. Retry shortly.",
      );
      return jsonResponse(unexpected.toBody(), unexpected.status, cors);
    }
  };
}
