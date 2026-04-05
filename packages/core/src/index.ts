export { ConsoleCapture, quickCapture, getQuickCaptureInstance } from "./ConsoleCapture";
export type { ConsoleLogEntry, CapturedJsError } from "./ConsoleCapture";

export { NetworkLogger } from "./NetworkLogger";
export type { NetworkLoggerOptions } from "./NetworkLogger";

export { BreadcrumbCapture } from "./BreadcrumbCapture";

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
  RecordingStopReason,
  ReportCaptureMode,
  ScreenshotHighlightRegion,
  SubmitProgressCallback,
  UserIdentity,
} from "./types";
export {
  DEFAULT_MAX_RECORDING_MS,
  formatConsoleLogs,
  formatJsErrors,
  formatNetworkLogs,
  toErrorMessage,
  toBlobFile,
  toRecordingFile,
  toScreenshotFile,
} from "./types";

export { LinearIntegration, type LinearIntegrationOptions } from "./integrations/linear";
export { JiraIntegration, type JiraIntegrationOptions } from "./integrations/jira";
export { CloudIntegration, type CloudIntegrationOptions } from "./integrations/cloud";
export type { BugReporterIntegrations } from "./integrations";
