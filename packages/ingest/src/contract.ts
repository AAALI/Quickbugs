/**
 * The ingest wire contract.
 *
 * This module is the single source of truth for what the browser SDK sends and
 * what a QuickBugs server accepts. Both sides import it, so a field cannot be
 * renamed on one side without breaking the other's build.
 *
 * The SDK posts `multipart/form-data` rather than JSON because a report carries
 * binary attachments (a screenshot, a screen recording) alongside its metadata,
 * and multipart lets both travel in one request without base64 inflation.
 */

/**
 * Wire format version, sent as `schema_version` on every report.
 *
 * Bump the major when a field changes meaning or is removed, so a server can
 * reject a payload it would otherwise misread. Adding an optional field is a
 * minor bump and needs no server change.
 */
export const SCHEMA_VERSION = "1.0";

/** Text fields carrying the report itself. */
export const REPORT_FIELDS = [
  "title",
  "description",
  "steps_to_reproduce",
  "expected_result",
  "actual_result",
  "additional_context",
] as const;

/** Text fields describing the capture and the environment it came from. */
export const CONTEXT_FIELDS = [
  "provider",
  "capture_mode",
  "capture_has_mic",
  "page_url",
  "user_agent",
  "browser_name",
  "browser_version",
  "os_name",
  "os_version",
  "device_type",
  "device_model",
  "device_brand",
  "screen_resolution",
  "viewport",
  "color_scheme",
  "locale",
  "timezone",
  "connection_type",
  "platform",
  "environment",
  "app_version",
  "app_build_number",
  "duration_ms",
  "stopped_at",
  "is_emulator",
  "invocation_method",
  "battery_level",
  "free_storage_mb",
  "has_screenshot",
  "has_video",
  "has_network_logs",
  "has_console_logs",
  "has_breadcrumbs",
  "js_error_count",
  "custom_metadata",
] as const;

/** Text fields identifying the person who filed the report. */
export const REPORTER_FIELDS = ["user_id", "user_email", "user_name"] as const;

/** Fields the server requires. Anything else is optional. */
export const REQUIRED_FIELDS = ["project_key", "title"] as const;

export type ReportField = (typeof REPORT_FIELDS)[number];
export type ContextField = (typeof CONTEXT_FIELDS)[number];
export type ReporterField = (typeof REPORTER_FIELDS)[number];

/**
 * Binary parts a report may carry.
 *
 * `maxBytes` is enforced per attachment; {@link LIMITS.totalBytes} caps the
 * request as a whole. `contentTypes` is an allow-list — a part whose type is not
 * listed is rejected rather than stored, because anything we accept here we
 * later hand to a browser to render.
 */
export const ATTACHMENTS = {
  screenshot: {
    field: "screenshot",
    contentTypes: ["image/png", "image/jpeg", "image/webp"],
    maxBytes: 10 * 1024 * 1024,
    required: false,
  },
  video: {
    field: "video",
    contentTypes: ["video/webm", "video/mp4"],
    maxBytes: 100 * 1024 * 1024,
    required: false,
  },
  network_logs: {
    field: "network_logs",
    contentTypes: ["text/plain"],
    maxBytes: 2 * 1024 * 1024,
    required: false,
  },
  console_logs: {
    field: "console_logs",
    contentTypes: ["text/plain"],
    maxBytes: 2 * 1024 * 1024,
    required: false,
  },
  breadcrumbs: {
    field: "breadcrumbs",
    contentTypes: ["application/json"],
    maxBytes: 1 * 1024 * 1024,
    required: false,
  },
  metadata: {
    field: "metadata",
    contentTypes: ["application/json"],
    maxBytes: 1 * 1024 * 1024,
    required: false,
  },
} as const;

export type AttachmentName = keyof typeof ATTACHMENTS;

export const ATTACHMENT_NAMES = Object.keys(ATTACHMENTS) as AttachmentName[];

/**
 * Server-side limits.
 *
 * These are deliberately generous — the point is to stop a runaway upload or a
 * hostile payload, not to police normal use. The SDK enforces its own tighter
 * caps at capture time; these are the backstop for a client that ignores them.
 */
export const LIMITS = {
  /** Longest accepted value for any single text field. */
  maxFieldLength: 8_000,
  /** Report title, which becomes the tracker issue summary. */
  maxTitleLength: 300,
  /** Combined size of every attachment in one request. */
  totalBytes: 120 * 1024 * 1024,
  /** Longest accepted project key. */
  maxProjectKeyLength: 128,
  /** Longest accepted client-supplied report id. */
  maxClientReportIdLength: 64,
} as const;

/**
 * Canonical project key format: `pk_live_…` or `pk_test_…`.
 *
 * Encoding the environment in the key means a development install cannot write
 * into production data by configuration mistake alone — the server can tell the
 * two apart without trusting a separate `environment` field the client controls.
 */
export const PROJECT_KEY_PATTERN = /^pk_(live|test)_[A-Za-z0-9]{16,64}$/;

export type ProjectKeyEnvironment = "live" | "test";

/**
 * Read the environment out of a canonical project key.
 *
 * @returns The environment, or `null` for a key that predates the format. The
 * caller decides whether to accept legacy keys — this function only reports
 * what the key says about itself.
 */
export function projectKeyEnvironment(projectKey: string): ProjectKeyEnvironment | null {
  const match = PROJECT_KEY_PATTERN.exec(projectKey);
  return match ? (match[1] as ProjectKeyEnvironment) : null;
}

/** Whether a project key matches the canonical format. */
export function isCanonicalProjectKey(projectKey: string): boolean {
  return PROJECT_KEY_PATTERN.test(projectKey);
}
