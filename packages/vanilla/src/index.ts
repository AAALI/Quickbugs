import { QuickBugsWidget, type QuickBugsInitOptions, type QuickBugsSubmitOptions } from "./QuickBugsWidget";

let instance: QuickBugsWidget | null = null;

/** Initialize QuickBugs and render the floating button. */
export function init(options: QuickBugsInitOptions): QuickBugsWidget {
  if (instance) instance.destroy();
  instance = new QuickBugsWidget(options);
  return instance;
}

/** Show the bug reporter menu/modal. */
export function showReporter(): void {
  instance?.showReporter();
}

/** Programmatically submit a bug report (headless). */
export async function submit(options: QuickBugsSubmitOptions): Promise<{ success: boolean; reportId: string; externalIssueUrl: string | null }> {
  if (!instance) return { success: false, reportId: "", externalIssueUrl: null };
  return instance.submit(options);
}

/** Destroy the widget and clean up. */
export function destroy(): void {
  instance?.destroy();
  instance = null;
}

export { QuickBugsWidget } from "./QuickBugsWidget";
export type { QuickBugsInitOptions, QuickBugsSubmitOptions } from "./QuickBugsWidget";

// Re-export core types and integrations
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

export { BugReporter } from "./core/BugReporter";
export { BugSession } from "./core/BugSession";
export { ScreenRecorder } from "./core/ScreenRecorder";
export { ScreenshotCapturer } from "./core/ScreenshotCapturer";
export type { CaptureRegion } from "./core/ScreenshotCapturer";
export { collectClientEnvironmentMetadata } from "./core/WebMetadata";
