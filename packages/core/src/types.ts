import type { ConsoleLogEntry, CapturedJsError } from "./ConsoleCapture";

export type { ConsoleLogEntry, CapturedJsError };

export const DEFAULT_MAX_RECORDING_MS = 2 * 60 * 1000;

export type BugTrackerProvider = "linear" | "jira" | "cloud";

export type ReportCaptureMode = "video" | "screenshot";

export type RecordingStopReason = "manual" | "time_limit" | "screen_ended";

export type NetworkLogEntry = {
  method: string;
  url: string;
  status: number | null;
  durationMs: number;
  timestamp: string;
};

export type ScreenshotHighlightRegion = {
  // Normalized coordinates (0..1) based on the screenshot image dimensions.
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MobileInvocationMethod = "shake" | "button" | "programmatic";

export type BugMobileMetadata = {
  platform: "ios" | "android";
  deviceModel: string | null;
  deviceBrand: string | null;
  osVersion: string | null;
  appBuildNumber: string | null;
  isEmulator: boolean;
  batteryLevel: number | null;
  freeStorageMb: number | null;
  invocationMethod: MobileInvocationMethod;
};

export type BugClientMetadata = {
  locale: string | null;
  timezone: string | null;
  language: string | null;
  languages: string[];
  platform: string | null;
  referrer: string | null;
  colorScheme: "light" | "dark" | "unknown";
  viewport: {
    width: number | null;
    height: number | null;
    pixelRatio: number | null;
  };
  screen: {
    width: number | null;
    height: number | null;
    availWidth: number | null;
    availHeight: number | null;
    colorDepth: number | null;
  };
  device: {
    hardwareConcurrency: number | null;
    deviceMemoryGb: number | null;
    maxTouchPoints: number | null;
    online: boolean | null;
    cookieEnabled: boolean | null;
  };
  connection: {
    effectiveType: string | null;
    downlinkMbps: number | null;
    rttMs: number | null;
    saveData: boolean | null;
  };
  captureMode: ReportCaptureMode;
  capture: {
    startedAt: string;
    stoppedAt: string;
    elapsedMs: number;
  };
  annotation?: {
    imageWidth: number;
    imageHeight: number;
    highlights: ScreenshotHighlightRegion[];
  };
  mobile?: BugMobileMetadata;
};

export type BugSessionArtifacts = {
  videoBlob: Blob | null;
  screenshotBlob: Blob | null;
  networkLogs: NetworkLogEntry[];
  captureMode: ReportCaptureMode;
  startedAt: string;
  stoppedAt: string;
  elapsedMs: number;
  stopReason: RecordingStopReason;
};

export type BugReportPayload = {
  title: string;
  description: string;
  videoBlob: Blob | null;
  screenshotBlob: Blob | null;
  networkLogs: NetworkLogEntry[];
  consoleLogs: ConsoleLogEntry[];
  jsErrors: CapturedJsError[];
  captureMode: ReportCaptureMode;
  pageUrl: string;
  userAgent: string;
  startedAt: string;
  stoppedAt: string;
  elapsedMs: number;
  metadata: BugClientMetadata;
};

export type BugSubmitResult = {
  provider: BugTrackerProvider;
  issueId: string;
  issueKey: string;
  issueUrl: string | null;
  warnings: string[];
};

export type SubmitProgressCallback = (message: string) => void;

export interface BugReporterIntegration {
  readonly provider: BugTrackerProvider;
  submit(payload: BugReportPayload, onProgress?: SubmitProgressCallback): Promise<BugSubmitResult>;
}

export function formatConsoleLogs(logs: ConsoleLogEntry[]): string {
  if (logs.length === 0) {
    return "No console output captured.";
  }

  return logs
    .map((entry) => {
      const tag = entry.level.toUpperCase().padEnd(5);
      const args = entry.args.join(" ");
      return `[${entry.timestamp}] ${tag} ${args}`;
    })
    .join("\n");
}

export function formatJsErrors(errors: CapturedJsError[]): string {
  if (errors.length === 0) {
    return "No JavaScript errors captured.";
  }

  return errors
    .map((entry) => {
      const lines = [`[${entry.timestamp}] ${entry.type}: ${entry.message}`];
      if (entry.source) {
        lines.push(`  at ${entry.source}${entry.lineno ? `:${entry.lineno}` : ""}${entry.colno ? `:${entry.colno}` : ""}`);
      }
      if (entry.stack) {
        lines.push(entry.stack.split("\n").map((l) => `  ${l}`).join("\n"));
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

export function formatNetworkLogs(logs: NetworkLogEntry[]): string {
  if (logs.length === 0) {
    return "No network requests captured.";
  }

  return logs
    .map((entry) => {
      const status = entry.status === null ? "FAILED" : String(entry.status);
      return `[${entry.timestamp}] ${entry.method.toUpperCase()} ${entry.url} -> ${status} (${entry.durationMs}ms)`;
    })
    .join("\n");
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unknown error";
}

export function toBlobFile(blob: Blob, fileName: string, fallbackMimeType: string): File {
  return new File([blob], fileName, {
    type: blob.type || fallbackMimeType,
    lastModified: Date.now(),
  });
}

export function toRecordingFile(blob: Blob, fileName = "bug-recording.webm"): File {
  return toBlobFile(blob, fileName, "video/webm");
}

export function toScreenshotFile(blob: Blob, fileName = "bug-screenshot.png"): File {
  return toBlobFile(blob, fileName, "image/png");
}
