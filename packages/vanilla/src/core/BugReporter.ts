import { BugSession } from "./BugSession";
import { CaptureRegion } from "./ScreenshotCapturer";
import type { ConsoleLogEntry, CapturedJsError, BreadcrumbEntry, UserIdentity } from "@quick-bug-reporter/core";
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
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  additionalContext?: string;
  user?: UserIdentity;
  breadcrumbs?: BreadcrumbEntry[];
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

  async start(): Promise<void> { await this.session.start(); }

  async captureScreenshot(region?: CaptureRegion): Promise<BugSessionArtifacts> {
    return this.session.captureScreenshot(region);
  }

  async stop(): Promise<BugSessionArtifacts | null> { return this.session.stop("manual"); }

  async submit(title: string, description: string, options: BugReporterSubmitOptions = {}): Promise<BugSubmitResult> {
    if (this.isRecording()) await this.stop();

    const artifacts = this.session.getLastArtifacts();
    // Allow submission without artifacts if explicitly requesting no capture
    const isNoCaptureMode = options.metadata?.captureMode === "none";
    if (!artifacts && !isNoCaptureMode) throw new Error("Capture a screenshot or record and stop a bug session before submitting.");

    const normalizedTitle = title.trim();
    if (!normalizedTitle) throw new Error("A bug title is required.");

    const normalizedDescription = description.trim() || "No additional details provided.";

    // Handle "none" mode with minimal artifacts
    const now = new Date().toISOString();
    const captureMode = artifacts?.captureMode ?? "none";
    const metadata: BugClientMetadata = {
      ...collectClientEnvironmentMetadata(),
      captureMode,
      capture: artifacts ? {
        startedAt: artifacts.startedAt,
        stoppedAt: artifacts.stoppedAt,
        elapsedMs: artifacts.elapsedMs,
      } : {
        startedAt: now,
        stoppedAt: now,
        elapsedMs: 0,
      },
      ...(options.metadata || {}),
    };

    const captureHasMic = artifacts ? this.session.getCaptureHasMic() : false;

    const payload = {
      title: normalizedTitle,
      description: normalizedDescription,
      stepsToReproduce: options.stepsToReproduce,
      expectedResult: options.expectedResult,
      actualResult: options.actualResult,
      additionalContext: options.additionalContext,
      videoBlob: artifacts?.videoBlob ?? null,
      screenshotBlob: options.screenshotBlob ?? artifacts?.screenshotBlob ?? null,
      networkLogs: artifacts ? this.session.finalizeNetworkLogsForSubmit(artifacts.captureMode) : [],
      consoleLogs: options.consoleLogs ?? [],
      jsErrors: options.jsErrors ?? [],
      captureMode,
      pageUrl: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      startedAt: artifacts?.startedAt ?? now,
      stoppedAt: artifacts?.stoppedAt ?? now,
      elapsedMs: artifacts?.elapsedMs ?? 0,
      metadata,
      captureHasMic,
      user: options.user,
      breadcrumbs: options.breadcrumbs,
    };

    options.onProgress?.("Submitting to " + this.integration.provider + "...");
    const result = await this.integration.submit(payload, options.onProgress);
    this.session.resetArtifacts();
    return result;
  }

  isRecording(): boolean { return this.session.isRecording(); }
  getElapsedMs(): number { return this.session.getElapsedMs(); }
  getMaxDurationMs(): number { return this.session.getMaxDurationMs(); }
  getLastArtifacts(): BugSessionArtifacts | null { return this.session.getLastArtifacts(); }

  clearDraft(): void { this.session.resetArtifacts(); }

  setIntegration(integration: BugReporterIntegration): void { this.integration = integration; }
  getSelectedProvider(): BugTrackerProvider { return this.integration.provider; }

  async dispose(): Promise<void> { await this.session.dispose(); }
}