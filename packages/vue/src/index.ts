export { QuickBugsProvider } from "./components/QuickBugsProvider";
export { FloatingBugButton } from "./components/FloatingBugButton";
export { BugReporterModal } from "./components/BugReporterModal";

export { useQuickBugs, QuickBugsKey } from "./composables/useQuickBugs";
export type {
  QuickBugsContext,
  HeadlessCaptureOptions,
  HeadlessCaptureResult,
} from "./composables/useQuickBugs";
export type { BreadcrumbConfig } from "./components/QuickBugsProvider";

// Capture engine — single implementation, re-exported from the core package.
export {
  BugReporter,
  BugSession,
  ScreenRecorder,
  ScreenshotCapturer,
  collectClientEnvironmentMetadata,
} from "@quick-bug-reporter/core";
export type {
  BugReporterOptions,
  BugReporterSubmitOptions,
  BugSessionOptions,
  CaptureRegion,
  ScreenshotPrivacyOptions,
} from "@quick-bug-reporter/core";

// Privacy controls and redaction helpers.
export {
  DEFAULT_BLOCK_SELECTORS,
  DEFAULT_MASK_SELECTORS,
  DEFAULT_REDACT_KEYS,
  REDACTED,
  redactUrl,
  resolvePrivacy,
} from "@quick-bug-reporter/core";
export type { PrivacyOptions, ResolvedPrivacy } from "@quick-bug-reporter/core";

// Re-exported from @quick-bug-reporter/core
export { NetworkLogger } from "@quick-bug-reporter/core";
export { ConsoleCapture, quickCapture, getQuickCaptureInstance } from "@quick-bug-reporter/core";
export { BreadcrumbCapture } from "@quick-bug-reporter/core";
export type { ConsoleLogEntry, CapturedJsError } from "@quick-bug-reporter/core";

export type {
  BreadcrumbEntry,
  BreadcrumbType,
  BugClientMetadata,
  BugReportPayload,
  BugReporterIntegration,
  BugSessionArtifacts,
  BugSubmitResult,
  BugTrackerProvider,
  NetworkLogEntry,
  NetworkLoggerOptions,
  RecordingStopReason,
  ReportCaptureMode,
  ScreenshotHighlightRegion,
  SubmitProgressCallback,
  UserIdentity,
} from "@quick-bug-reporter/core";
export {
  DEFAULT_MAX_RECORDING_MS,
  formatConsoleLogs,
  formatJsErrors,
  formatNetworkLogs,
  toErrorMessage,
} from "@quick-bug-reporter/core";

export { LinearIntegration, type LinearIntegrationOptions } from "@quick-bug-reporter/core";
export { JiraIntegration, type JiraIntegrationOptions } from "@quick-bug-reporter/core";
export { CloudIntegration, type CloudIntegrationOptions } from "@quick-bug-reporter/core";
export type { BugReporterIntegrations } from "@quick-bug-reporter/core";
