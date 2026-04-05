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

export { BugReporter } from "./core/BugReporter";
export { BugSession } from "./core/BugSession";
export { ScreenRecorder } from "./core/ScreenRecorder";
export { ScreenshotCapturer } from "./core/ScreenshotCapturer";
export type { CaptureRegion } from "./core/ScreenshotCapturer";
export { collectClientEnvironmentMetadata } from "./core/WebMetadata";

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
