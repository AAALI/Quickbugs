/**
 * Supabase Edge Function adapter for QuickBugs ingest.
 *
 * Deliberately thin. Every decision — parsing, validation, limits, idempotency,
 * CORS — lives in `@quick-bug-reporter/ingest`, which is unit-tested and runtime
 * agnostic. This file only implements the storage port against Supabase, so a
 * self-hosted deployment can swap it for Postgres and S3 without reimplementing
 * any of the rules.
 *
 * Deploy:
 *   supabase functions deploy ingest --no-verify-jwt
 *
 * `--no-verify-jwt` is required: reports arrive from anonymous end users of the
 * customer's app, authenticated by the project key rather than a Supabase JWT.
 */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  type CreateReportInput,
  type IngestStore,
  type ProjectRecord,
  type PutAttachmentInput,
  createIngestHandler,
} from "npm:@quick-bug-reporter/ingest@0.1.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_BASE_URL = Deno.env.get("QUICKBUGS_APP_URL") ?? undefined;
const NOTIFY_WEBHOOK_URL = Deno.env.get("QUICKBUGS_NOTIFY_WEBHOOK_URL");

const ATTACHMENT_BUCKET = "report-attachments";

/** Columns promoted out of the payload; the rest are kept in `fields`. */
const PROMOTED_COLUMNS = [
  "title",
  "description",
  "steps_to_reproduce",
  "expected_result",
  "actual_result",
  "additional_context",
  "page_url",
  "capture_mode",
  "environment",
  "app_version",
  "browser_name",
  "os_name",
] as const;

/** File extension per attachment, so stored objects are recognisable. */
const ATTACHMENT_EXTENSIONS: Record<string, string> = {
  screenshot: "png",
  video: "webm",
  network_logs: "txt",
  console_logs: "txt",
  breadcrumbs: "json",
  metadata: "json",
};

class SupabaseIngestStore implements IngestStore {
  constructor(private readonly client: SupabaseClient) {}

  async findProjectByKey(projectKey: string): Promise<ProjectRecord | null> {
    const { data, error } = await this.client
      .from("projects")
      .select("id, allowed_origins, active")
      .eq("project_key", projectKey)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      allowedOrigins: data.allowed_origins ?? [],
      active: data.active,
    };
  }

  async findReportByClientId(projectId: string, clientReportId: string) {
    const { data } = await this.client
      .from("reports")
      .select("id, created_at")
      .eq("project_id", projectId)
      .eq("client_report_id", clientReportId)
      .maybeSingle();

    return data ? { id: data.id, createdAt: data.created_at } : null;
  }

  async createReport(input: CreateReportInput) {
    const promoted: Record<string, string> = {};
    const remaining: Record<string, string> = { ...input.fields };

    for (const column of PROMOTED_COLUMNS) {
      if (remaining[column] !== undefined) {
        promoted[column] = remaining[column];
        delete remaining[column];
      }
    }

    // Reporter identity gets its own columns so the inbox can group by person
    // without digging through the JSON blob.
    const reporterEmail = remaining.user_email;
    const reporterName = remaining.user_name;

    const { data, error } = await this.client
      .from("reports")
      .insert({
        project_id: input.projectId,
        client_report_id: input.clientReportId,
        schema_version: input.schemaVersion,
        ...promoted,
        reporter_email: reporterEmail ?? null,
        reporter_name: reporterName ?? null,
        fields: remaining,
        created_at: input.receivedAt,
      })
      .select("id, created_at")
      .single();

    if (error || !data) {
      // A unique-violation means a concurrent retry won the race. Return the
      // row it created rather than failing a submission that did succeed.
      if (error?.code === "23505" && input.clientReportId) {
        const existing = await this.findReportByClientId(input.projectId, input.clientReportId);
        if (existing) {
          return existing;
        }
      }

      throw new Error(error?.message ?? "Report insert returned no row");
    }

    return { id: data.id, createdAt: data.created_at };
  }

  async putAttachment(input: PutAttachmentInput): Promise<void> {
    const { projectId, reportId, attachment } = input;
    const extension = ATTACHMENT_EXTENSIONS[attachment.name] ?? "bin";
    const path = `${projectId}/${reportId}/${attachment.name}.${extension}`;

    const { error: uploadError } = await this.client.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, attachment.blob, {
        contentType: attachment.contentType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { error: rowError } = await this.client.from("report_attachments").upsert(
      {
        report_id: reportId,
        name: attachment.name,
        storage_path: path,
        content_type: attachment.contentType,
        size_bytes: attachment.sizeBytes,
      },
      { onConflict: "report_id,name" },
    );

    if (rowError) {
      throw new Error(rowError.message);
    }
  }
}

const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const handler = createIngestHandler({
  store: new SupabaseIngestStore(client),
  appBaseUrl: APP_BASE_URL,

  /**
   * The concierge loop: ping a webhook the moment a report lands, so an
   * operator can read it and reply to the customer the same day. This is what
   * makes design-partner onboarding work before an inbox UI exists.
   */
  onReportCreated: async (event) => {
    if (!NOTIFY_WEBHOOK_URL) {
      return;
    }

    await fetch(NOTIFY_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `New bug report: ${event.title}${event.reportUrl ? `\n${event.reportUrl}` : ""}`,
        report_id: event.reportId,
        project_id: event.projectId,
        attachment_count: event.attachmentCount,
      }),
    });
  },
});

Deno.serve(handler);
