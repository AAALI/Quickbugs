// --- Capture engine -------------------------------------------------------
// The single implementation shared by the React, Vue, and vanilla bindings.
// Framework packages re-export these; they must not fork them.

export { BugReporter } from "./capture/BugReporter";
export type { BugReporterOptions, BugReporterSubmitOptions } from "./capture/BugReporter";
export { BugSession } from "./capture/BugSession";
export type { BugSessionOptions } from "./capture/BugSession";
export { ScreenRecorder } from "./capture/ScreenRecorder";
export { ScreenshotCapturer } from "./capture/ScreenshotCapturer";
export type { CaptureRegion, ScreenshotPrivacyOptions } from "./capture/ScreenshotCapturer";
export { collectClientEnvironmentMetadata } from "./capture/WebMetadata";

// --- Instrumentation ------------------------------------------------------

export { ConsoleCapture, quickCapture, getQuickCaptureInstance } from "./ConsoleCapture";
export type { ConsoleLogEntry, CapturedJsError } from "./ConsoleCapture";

export { NetworkLogger } from "./NetworkLogger";
export type { NetworkLoggerOptions } from "./NetworkLogger";

export { BreadcrumbCapture } from "./BreadcrumbCapture";

export { createReportId } from "./reportId";

// --- Privacy --------------------------------------------------------------

export {
  DEFAULT_BLOCK_SELECTORS,
  DEFAULT_MASK_SELECTORS,
  DEFAULT_REDACT_KEYS,
  DEFAULT_REDACT_QUERY_EXACT,
  DEFAULT_REDACT_QUERY_SUBSTRINGS,
  REDACTED,
  redactJson,
  redactUrl,
  redactValue,
  resolvePrivacy,
  truncate,
} from "./privacy";
export type { PrivacyOptions, ResolvedPrivacy } from "./privacy";

// --- Types ----------------------------------------------------------------

export type {
  BreadcrumbEntry,
  BreadcrumbType,
  BugClientMetadata,
  BugMobileMetadata,
  BugReportPayload,
  BugReporterIntegration,
  BugSessionArtifacts,
  BugSubmitResult,
  BugTrackerProvider,
  MobileInvocationMethod,
  NetworkLogEntry,
  RecordingStopReason,
  ReportCaptureMode,
  ScreenshotHighlightRegion,
  SubmitProgressCallback,
  UserIdentity,
} from "./types";
export {
  DEFAULT_MAX_RECORDING_MS,
  REPORT_SCHEMA_VERSION,
  formatConsoleLogs,
  formatJsErrors,
  formatNetworkLogs,
  toErrorMessage,
  toBlobFile,
  toRecordingFile,
  toScreenshotFile,
} from "./types";

// --- Integrations ---------------------------------------------------------

export { LinearIntegration, type LinearIntegrationOptions } from "./integrations/linear";
export { JiraIntegration, type JiraIntegrationOptions } from "./integrations/jira";
export { CloudIntegration, type CloudIntegrationOptions, type MetadataHook } from "./integrations/cloud";
export type { BugReporterIntegrations } from "./integrations";
