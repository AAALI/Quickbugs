import { BugSession } from "./BugSession";
import { CaptureRegion } from "./ScreenshotCapturer";
import type { ConsoleLogEntry, CapturedJsError } from "@quick-bug-reporter/core";
import {
  BugClientMetadata,
  BugReporterIntegration,
  BugSessionArtifacts,
  BugSubmitResult,
  BugTrackerProvider,
  DEFAULT_MAX_RECORDING_MS,
  SubmitProgressCallback,
} from "@quick-bug-reporter/core";
import { collectClientEnvironmentMetadata } from "./WebMetadata";

type BugReporterOptions = {
  integration: BugReporterIntegration;
  maxDurationMs?: number;
  onAutoStop?: (artifacts: BugSessionArtifacts) => void;
  session?: BugSession;
};

type BugReporterSubmitOptions = {
  screenshotBlob?: Blob | null;
  metadata?: Partial<BugClientMetadata>;
  consoleLogs?: ConsoleLogEntry[];
  jsErrors?: CapturedJsError[];
  onProgress?: SubmitProgressCallback;
};

export class BugReporter {
  private integration: BugReporterIntegration;
  private readonly session: BugSession;

  constructor(options: BugReporterOptions) {
    this.integration = options.integration;
    this.session =
      options.session ??
      new BugSession({
        maxDurationMs: options.maxDurationMs ?? DEFAULT_MAX_RECORDING_MS,
        onAutoStop: options.onAutoStop,
      });
  }

  async start(): Promise<void> {
    await this.session.start();
  }

  async captureScreenshot(region?: CaptureRegion): Promise<BugSessionArtifacts> {
    return this.session.captureScreenshot(region);
  }

  async stop(): Promise<BugSessionArtifacts | null> {
    return this.session.stop("manual");
  }

  async submit(title: string, description: string, options: BugReporterSubmitOptions = {}): Promise<BugSubmitResult> {
    if (this.isRecording()) {
      await this.stop();
    }

    const artifacts = this.session.getLastArtifacts();

    if (!artifacts) {
      throw new Error("Capture a screenshot or record and stop a bug session before submitting.");
    }

    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      throw new Error("A bug title is required.");
    }

    const normalizedDescription = description.trim() || "No additional details provided.";

    const metadata: BugClientMetadata = {
      ...collectClientEnvironmentMetadata(),
      captureMode: artifacts.captureMode,
      capture: {
        startedAt: artifacts.startedAt,
        stoppedAt: artifacts.stoppedAt,
        elapsedMs: artifacts.elapsedMs,
      },
      ...(options.metadata || {}),
    };

    const payload = {
      title: normalizedTitle,
      description: normalizedDescription,
      videoBlob: artifacts.videoBlob,
      screenshotBlob: options.screenshotBlob ?? artifacts.screenshotBlob,
      networkLogs: this.session.finalizeNetworkLogsForSubmit(artifacts.captureMode),
      consoleLogs: options.consoleLogs ?? [],
      jsErrors: options.jsErrors ?? [],
      captureMode: artifacts.captureMode,
      pageUrl: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      startedAt: artifacts.startedAt,
      stoppedAt: artifacts.stoppedAt,
      elapsedMs: artifacts.elapsedMs,
      metadata,
    };

    options.onProgress?.("Submitting to " + this.integration.provider + "…");
    const result = await this.integration.submit(payload, options.onProgress);
    this.session.resetArtifacts();

    return result;
  }

  isRecording(): boolean {
    return this.session.isRecording();
  }

  getElapsedMs(): number {
    return this.session.getElapsedMs();
  }

  getMaxDurationMs(): number {
    return this.session.getMaxDurationMs();
  }

  getLastArtifacts(): BugSessionArtifacts | null {
    return this.session.getLastArtifacts();
  }

  clearDraft(): void {
    this.session.resetArtifacts();
  }

  setIntegration(integration: BugReporterIntegration): void {
    this.integration = integration;
  }

  getSelectedProvider(): BugTrackerProvider {
    return this.integration.provider;
  }

  async dispose(): Promise<void> {
    await this.session.dispose();
  }
}
