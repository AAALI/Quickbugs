import { NetworkLogger, type NetworkLogEntry } from "@quick-bug-reporter/core";
import { ScreenRecorder } from "./ScreenRecorder";
import { CaptureRegion, ScreenshotCapturer } from "./ScreenshotCapturer";
import {
  BugSessionArtifacts,
  DEFAULT_MAX_RECORDING_MS,
  RecordingStopReason,
  ReportCaptureMode,
} from "@quick-bug-reporter/core";

type BugSessionOptions = {
  maxDurationMs?: number;
  screenRecorder?: ScreenRecorder;
  screenshotCapturer?: ScreenshotCapturer;
  networkLogger?: NetworkLogger;
  onAutoStop?: (artifacts: BugSessionArtifacts) => void;
};

export class BugSession {
  private readonly maxDurationMs: number;
  private readonly screenRecorder: ScreenRecorder;
  private readonly screenshotCapturer: ScreenshotCapturer;
  private readonly networkLogger: NetworkLogger;
  private readonly onAutoStop?: (artifacts: BugSessionArtifacts) => void;

  private recording = false;
  private startedAtMs: number | null = null;
  private autoStopTimeout: ReturnType<typeof setTimeout> | null = null;
  private stopInFlight: Promise<BugSessionArtifacts | null> | null = null;
  private lastArtifacts: BugSessionArtifacts | null = null;
  private screenshotLogsPendingSubmit = false;

  constructor(options: BugSessionOptions = {}) {
    this.maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_RECORDING_MS;
    this.screenRecorder = options.screenRecorder ?? new ScreenRecorder();
    this.screenshotCapturer = options.screenshotCapturer ?? new ScreenshotCapturer();
    this.networkLogger = options.networkLogger ?? new NetworkLogger();
    this.onAutoStop = options.onAutoStop;
  }

  async start(): Promise<void> {
    if (this.recording) {
      return;
    }

    if (this.networkLogger.isRecording()) {
      this.networkLogger.stop();
    }

    this.clearAutoStopTimer();
    this.networkLogger.clear();
    this.lastArtifacts = null;
    this.screenshotLogsPendingSubmit = false;

    this.networkLogger.start();

    try {
      await this.screenRecorder.start({
        onEnded: () => {
          void this.handleForcedStop("screen_ended");
        },
      });
    } catch (error) {
      this.networkLogger.stop();
      this.networkLogger.clear();
      throw error;
    }

    this.recording = true;
    this.startedAtMs = Date.now();

    this.autoStopTimeout = setTimeout(() => {
      void this.handleForcedStop("time_limit");
    }, this.maxDurationMs);
  }

  async captureScreenshot(region?: CaptureRegion): Promise<BugSessionArtifacts> {
    if (this.recording) {
      await this.stop("manual");
    }

    if (this.networkLogger.isRecording()) {
      this.networkLogger.stop();
    }

    this.clearAutoStopTimer();
    this.networkLogger.clear();
    this.lastArtifacts = null;
    this.screenshotLogsPendingSubmit = false;

    const startedAtMs = Date.now();
    this.networkLogger.start();

    try {
      const screenshotBlob = region
        ? await this.screenshotCapturer.captureRegion(region)
        : await this.screenshotCapturer.capture();
      const networkLogs = this.networkLogger.getLogs();
      const stoppedAtMs = Date.now();

      const artifacts: BugSessionArtifacts = {
        videoBlob: null,
        screenshotBlob,
        networkLogs,
        captureMode: "screenshot",
        startedAt: new Date(startedAtMs).toISOString(),
        stoppedAt: new Date(stoppedAtMs).toISOString(),
        elapsedMs: Math.max(0, stoppedAtMs - startedAtMs),
        stopReason: "manual",
      };

      this.lastArtifacts = artifacts;
      this.screenshotLogsPendingSubmit = true;
      return artifacts;
    } catch (error) {
      this.networkLogger.stop();
      this.networkLogger.clear();
      this.screenshotLogsPendingSubmit = false;
      throw error;
    }
  }

  async stop(reason: RecordingStopReason = "manual"): Promise<BugSessionArtifacts | null> {
    if (this.stopInFlight) {
      return this.stopInFlight;
    }

    if (!this.recording) {
      return this.lastArtifacts;
    }

    this.stopInFlight = this.stopInternal(reason).finally(() => {
      this.stopInFlight = null;
    });

    return this.stopInFlight;
  }

  isRecording(): boolean {
    return this.recording;
  }

  getElapsedMs(): number {
    if (this.recording && this.startedAtMs) {
      return Math.max(0, Date.now() - this.startedAtMs);
    }

    return this.lastArtifacts?.elapsedMs ?? 0;
  }

  getMaxDurationMs(): number {
    return this.maxDurationMs;
  }

  getLastArtifacts(): BugSessionArtifacts | null {
    return this.lastArtifacts;
  }

  getLastCaptureMode(): ReportCaptureMode | null {
    return this.lastArtifacts?.captureMode ?? null;
  }

  finalizeNetworkLogsForSubmit(captureMode: ReportCaptureMode): NetworkLogEntry[] {
    if (
      captureMode === "screenshot" &&
      this.screenshotLogsPendingSubmit &&
      this.networkLogger.isRecording()
    ) {
      const logs = this.networkLogger.stop();
      this.screenshotLogsPendingSubmit = false;
      return logs;
    }

    return this.networkLogger.getLogs();
  }

  resetArtifacts(): void {
    this.lastArtifacts = null;
    this.screenRecorder.clearLastBlob();

    if (this.networkLogger.isRecording()) {
      this.networkLogger.stop();
    }

    this.networkLogger.clear();
    this.screenshotLogsPendingSubmit = false;
  }

  async dispose(): Promise<void> {
    await this.stop("manual");
    this.clearAutoStopTimer();
    this.screenRecorder.dispose();

    if (this.networkLogger.isRecording()) {
      this.networkLogger.stop();
    }

    this.networkLogger.clear();
    this.screenshotLogsPendingSubmit = false;
  }

  private async stopInternal(reason: RecordingStopReason): Promise<BugSessionArtifacts | null> {
    this.clearAutoStopTimer();

    const startedAtMs = this.startedAtMs ?? Date.now();

    this.recording = false;
    this.startedAtMs = null;

    const videoBlob = await this.screenRecorder.stop();
    const networkLogs = this.networkLogger.stop();

    const stoppedAtMs = Date.now();
    const artifacts: BugSessionArtifacts = {
      videoBlob,
      screenshotBlob: null,
      networkLogs,
      captureMode: "video",
      startedAt: new Date(startedAtMs).toISOString(),
      stoppedAt: new Date(stoppedAtMs).toISOString(),
      elapsedMs: Math.max(0, stoppedAtMs - startedAtMs),
      stopReason: reason,
    };

    this.lastArtifacts = artifacts;
    this.screenshotLogsPendingSubmit = false;

    return artifacts;
  }

  private async handleForcedStop(reason: Exclude<RecordingStopReason, "manual">): Promise<void> {
    const artifacts = await this.stop(reason);

    if (artifacts && this.onAutoStop) {
      this.onAutoStop(artifacts);
    }
  }

  private clearAutoStopTimer(): void {
    if (this.autoStopTimeout) {
      clearTimeout(this.autoStopTimeout);
      this.autoStopTimeout = null;
    }
  }
}
