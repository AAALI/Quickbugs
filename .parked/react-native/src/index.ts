export {
  ConsoleCapture,
  NetworkLogger,
  LinearIntegration,
  JiraIntegration,
  CloudIntegration,
  DEFAULT_MAX_RECORDING_MS,
  formatConsoleLogs,
  formatJsErrors,
  formatNetworkLogs,
  toErrorMessage,
  toBlobFile,
  toRecordingFile,
  toScreenshotFile,
} from "@quick-bug-reporter/core";

export type {
  BugClientMetadata,
  BugMobileMetadata,
  BugReportPayload,
  BugReporterIntegration,
  BugReporterIntegrations,
  BugSessionArtifacts,
  BugSubmitResult,
  BugTrackerProvider,
  CapturedJsError,
  CloudIntegrationOptions,
  ConsoleLogEntry,
  LinearIntegrationOptions,
  JiraIntegrationOptions,
  MobileInvocationMethod,
  NetworkLogEntry,
  RecordingStopReason,
  ReportCaptureMode,
  ScreenshotHighlightRegion,
  SubmitProgressCallback,
} from "@quick-bug-reporter/core";

export { BugReporter } from "./core/BugReporter";
export { BugSession } from "./core/BugSession";
export { ScreenshotCapturer } from "./core/ScreenshotCapturer";
export { ScreenRecorder } from "./core/ScreenRecorder";
export { NativeConsoleCapture } from "./core/NativeConsoleCapture";
export { collectDeviceMetadata } from "./core/DeviceMetadata";
export { useShakeDetector } from "./core/ShakeDetector";

export { BugReporterProvider, useBugReporter } from "./ui/BugReporterProvider";
export { BugReporterModal } from "./ui/BugReporterModal";
export { FloatingBugButton } from "./ui/FloatingBugButton";
export { ScreenshotAnnotator } from "./ui/ScreenshotAnnotator";
