// The wire contract — imported by both the SDK and any server implementation.
export {
  ATTACHMENTS,
  ATTACHMENT_NAMES,
  CONTEXT_FIELDS,
  LIMITS,
  PROJECT_KEY_PATTERN,
  REPORTER_FIELDS,
  REPORT_FIELDS,
  REQUIRED_FIELDS,
  SCHEMA_VERSION,
  isCanonicalProjectKey,
  projectKeyEnvironment,
} from "./contract";
export type {
  AttachmentName,
  ContextField,
  ProjectKeyEnvironment,
  ReportField,
  ReporterField,
} from "./contract";

export { IngestError, isIngestError } from "./errors";
export type { IngestErrorBody, IngestErrorCode } from "./errors";

export { parseIngestForm, parseIngestRequest } from "./parse";
export type { ParsedAttachment, ParsedReport } from "./parse";

export { assertOriginAllowed, corsHeaders, originMatches } from "./origins";

export { createIngestHandler } from "./handler";
export type {
  CreateReportInput,
  IngestHandlerOptions,
  IngestStore,
  IngestSuccessBody,
  ProjectRecord,
  PutAttachmentInput,
  ReportCreatedEvent,
} from "./handler";
