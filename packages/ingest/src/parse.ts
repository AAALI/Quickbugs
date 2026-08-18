/**
 * Turn an incoming multipart request into a typed, validated report.
 *
 * Parsing is deliberately separate from storage. Everything here is pure and
 * runtime-agnostic — it runs the same on Supabase Edge, Node, Cloudflare, or a
 * customer's own server, which is what makes a self-hosted deployment possible
 * without a second implementation.
 */

import {
  ATTACHMENTS,
  ATTACHMENT_NAMES,
  type AttachmentName,
  CONTEXT_FIELDS,
  LIMITS,
  REPORTER_FIELDS,
  REPORT_FIELDS,
  REQUIRED_FIELDS,
  SCHEMA_VERSION,
  projectKeyEnvironment,
} from "./contract";
import { IngestError } from "./errors";

/** One binary part of a report, ready to be written to storage. */
export type ParsedAttachment = {
  name: AttachmentName;
  blob: Blob;
  contentType: string;
  sizeBytes: number;
  /** Filename the client supplied, when it sent one. */
  fileName?: string;
};

export type ParsedReport = {
  projectKey: string;
  /** Environment named by the key itself, or `null` for a legacy key. */
  environment: "live" | "test" | null;
  schemaVersion: string;
  /**
   * Client-generated id for this capture.
   *
   * Stable across retries of the same report, which is what makes ingest
   * idempotent: a client whose upload times out can safely send the whole
   * report again without the user re-recording it.
   */
  clientReportId: string | null;
  /** Text fields, with empty values dropped rather than stored as "". */
  fields: Record<string, string>;
  attachments: ParsedAttachment[];
  totalAttachmentBytes: number;
};

const ALL_TEXT_FIELDS: readonly string[] = [
  "project_key",
  "schema_version",
  "client_report_id",
  ...REPORT_FIELDS,
  ...CONTEXT_FIELDS,
  ...REPORTER_FIELDS,
];

/** Fields excluded from the stored record because they are handled separately. */
const HANDLED_SEPARATELY = new Set(["project_key", "schema_version", "client_report_id"]);

/**
 * Accept a payload whose major version matches ours.
 *
 * A minor bump means the client added an optional field we will simply ignore,
 * so refusing it would break older servers against newer SDKs for no benefit.
 */
function assertSupportedSchemaVersion(version: string): void {
  const [major] = version.split(".");
  const [supportedMajor] = SCHEMA_VERSION.split(".");

  if (major !== supportedMajor) {
    throw new IngestError(
      "unsupported_schema_version",
      `This server accepts report schema ${supportedMajor}.x but received ${version}. Upgrade the server or pin the SDK.`,
      "schema_version",
    );
  }
}

/** Read a text field, rejecting a part that arrived as a file. */
function readTextField(form: FormData, name: string): string | null {
  const value = form.get(name);

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new IngestError(
      "malformed_request",
      `Field "${name}" must be a text value, not a file.`,
      name,
    );
  }

  return value;
}

/** Validate and collect one attachment, if the client sent it. */
function readAttachment(form: FormData, name: AttachmentName): ParsedAttachment | null {
  const value = form.get(name);

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    throw new IngestError(
      "malformed_request",
      `Attachment "${name}" must be a file, not a text value.`,
      name,
    );
  }

  const spec = ATTACHMENTS[name];
  const blob = value as Blob;

  // A Blob's type can be empty when the client omits it; treat that as unknown
  // rather than guessing, since the allow-list is a security boundary.
  const contentType = (blob.type || "").split(";")[0].trim().toLowerCase();

  if (!(spec.contentTypes as readonly string[]).includes(contentType)) {
    throw new IngestError(
      "unsupported_attachment_type",
      `Attachment "${name}" must be one of ${spec.contentTypes.join(", ")} but was "${contentType || "unknown"}".`,
      name,
    );
  }

  if (blob.size > spec.maxBytes) {
    throw new IngestError(
      "attachment_too_large",
      `Attachment "${name}" is ${blob.size} bytes, over the ${spec.maxBytes} byte limit.`,
      name,
    );
  }

  return {
    name,
    blob,
    contentType,
    sizeBytes: blob.size,
    fileName: value instanceof File ? value.name : undefined,
  };
}

/**
 * Parse a report out of submitted form data.
 *
 * @throws {IngestError} for any payload the server will not store. Callers map
 * the error's `status` and `toBody()` straight onto the HTTP response.
 */
export function parseIngestForm(form: FormData): ParsedReport {
  const projectKey = readTextField(form, "project_key")?.trim() ?? "";

  if (!projectKey) {
    throw new IngestError(
      "missing_field",
      'Missing "project_key". Pass the key from your project settings to CloudIntegration.',
      "project_key",
    );
  }

  if (projectKey.length > LIMITS.maxProjectKeyLength) {
    throw new IngestError("invalid_project_key", "Project key is too long.", "project_key");
  }

  const schemaVersion = readTextField(form, "schema_version")?.trim() || SCHEMA_VERSION;
  assertSupportedSchemaVersion(schemaVersion);

  const clientReportId = readTextField(form, "client_report_id")?.trim() || null;

  if (clientReportId && clientReportId.length > LIMITS.maxClientReportIdLength) {
    throw new IngestError(
      "field_too_long",
      "Client report id is too long.",
      "client_report_id",
    );
  }

  const fields: Record<string, string> = {};

  for (const name of ALL_TEXT_FIELDS) {
    if (HANDLED_SEPARATELY.has(name)) {
      continue;
    }

    const value = readTextField(form, name);

    // Absent and empty are the same thing to us: the client sends "" for
    // context it could not determine, and storing that is just noise.
    if (value === null || value === "") {
      continue;
    }

    const limit = name === "title" ? LIMITS.maxTitleLength : LIMITS.maxFieldLength;

    if (value.length > limit) {
      throw new IngestError(
        "field_too_long",
        `Field "${name}" is ${value.length} characters, over the ${limit} character limit.`,
        name,
      );
    }

    fields[name] = value;
  }

  for (const required of REQUIRED_FIELDS) {
    if (required !== "project_key" && !fields[required]) {
      throw new IngestError("missing_field", `Missing required field "${required}".`, required);
    }
  }

  const attachments: ParsedAttachment[] = [];
  let totalAttachmentBytes = 0;

  for (const name of ATTACHMENT_NAMES) {
    const attachment = readAttachment(form, name);

    if (attachment) {
      attachments.push(attachment);
      totalAttachmentBytes += attachment.sizeBytes;
    }
  }

  if (totalAttachmentBytes > LIMITS.totalBytes) {
    throw new IngestError(
      "payload_too_large",
      `Attachments total ${totalAttachmentBytes} bytes, over the ${LIMITS.totalBytes} byte request limit.`,
    );
  }

  return {
    projectKey,
    environment: projectKeyEnvironment(projectKey),
    schemaVersion,
    clientReportId,
    fields,
    attachments,
    totalAttachmentBytes,
  };
}

/**
 * Parse a report out of an HTTP request.
 *
 * Wraps {@link parseIngestForm} with the content-type check and the body read,
 * so every runtime adapter gets identical behaviour for a malformed body.
 */
export async function parseIngestRequest(request: Request): Promise<ParsedReport> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new IngestError(
      "invalid_content_type",
      "Reports must be posted as multipart/form-data.",
    );
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    throw new IngestError("malformed_request", "Request body is not valid multipart/form-data.");
  }

  return parseIngestForm(form);
}
