import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NetworkLogger } from "../NetworkLogger";
import { BugSession } from "./BugSession";
import type { ScreenRecorder } from "./ScreenRecorder";
import type { ScreenshotCapturer } from "./ScreenshotCapturer";

/** Recorder double: no browser APIs, controllable stop payload. */
function fakeRecorder(overrides: Partial<ScreenRecorder> = {}): ScreenRecorder {
  const blob = new Blob(["video"], { type: "video/webm" });

  return {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => blob),
    dispose: vi.fn(),
    clearLastBlob: vi.fn(),
    isRecording: vi.fn(() => false),
    getLastBlob: vi.fn(() => blob),
    hasMic: false,
    ...overrides,
  } as unknown as ScreenRecorder;
}

function fakeCapturer(overrides: Partial<ScreenshotCapturer> = {}): ScreenshotCapturer {
  const blob = new Blob(["png"], { type: "image/png" });

  return {
    capture: vi.fn(async () => blob),
    captureRegion: vi.fn(async () => blob),
    ...overrides,
  } as unknown as ScreenshotCapturer;
}

describe("BugSession", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => new Response("{}")) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("produces video artifacts on a normal record/stop cycle", async () => {
    const session = new BugSession({ screenRecorder: fakeRecorder() });

    await session.start();
    expect(session.isRecording()).toBe(true);

    const artifacts = await session.stop("manual");

    expect(artifacts?.captureMode).toBe("video");
    expect(artifacts?.videoBlob).toBeInstanceOf(Blob);
    expect(artifacts?.stopReason).toBe("manual");
    expect(session.isRecording()).toBe(false);
  });

  it("stops network logging when the recorder fails to start", async () => {
    // A failed start must not leave fetch permanently patched.
    const networkLogger = new NetworkLogger();
    const recorder = fakeRecorder({
      start: vi.fn(async () => {
        throw new Error("Screen or microphone permission was denied.");
      }) as unknown as ScreenRecorder["start"],
    });

    const session = new BugSession({ screenRecorder: recorder, networkLogger });

    await expect(session.start()).rejects.toThrow("permission was denied");
    expect(networkLogger.isRecording()).toBe(false);
    expect(session.isRecording()).toBe(false);
  });

  it("returns screenshot artifacts without a video blob", async () => {
    const session = new BugSession({
      screenRecorder: fakeRecorder(),
      screenshotCapturer: fakeCapturer(),
    });

    const artifacts = await session.captureScreenshot();

    expect(artifacts.captureMode).toBe("screenshot");
    expect(artifacts.screenshotBlob).toBeInstanceOf(Blob);
    expect(artifacts.videoBlob).toBeNull();
  });

  it("passes a region through to the capturer", async () => {
    const capturer = fakeCapturer();
    const session = new BugSession({ screenRecorder: fakeRecorder(), screenshotCapturer: capturer });
    const region = { x: 10, y: 20, width: 100, height: 50 };

    await session.captureScreenshot(region);

    expect(capturer.captureRegion).toHaveBeenCalledWith(region);
  });

  it("auto-stops at the duration limit and reports the reason", async () => {
    vi.useFakeTimers();
    const onAutoStop = vi.fn();

    const session = new BugSession({
      screenRecorder: fakeRecorder(),
      maxDurationMs: 1000,
      onAutoStop,
    });

    await session.start();
    await vi.advanceTimersByTimeAsync(1001);

    expect(onAutoStop).toHaveBeenCalledOnce();
    expect(onAutoStop.mock.calls[0][0].stopReason).toBe("time_limit");
    vi.useRealTimers();
  });

  it("collapses concurrent stop calls into one", async () => {
    const recorder = fakeRecorder();
    const session = new BugSession({ screenRecorder: recorder });

    await session.start();
    const [first, second] = await Promise.all([session.stop("manual"), session.stop("manual")]);

    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(first).toBe(second);
  });

  it("returns the last artifacts when stopped while not recording", async () => {
    const session = new BugSession({ screenRecorder: fakeRecorder() });

    await session.start();
    const stopped = await session.stop("manual");

    expect(await session.stop("manual")).toBe(stopped);
  });

  it("clears artifacts and network state on reset", async () => {
    const session = new BugSession({ screenRecorder: fakeRecorder() });

    await session.start();
    await session.stop("manual");
    expect(session.getLastArtifacts()).not.toBeNull();

    session.resetArtifacts();
    expect(session.getLastArtifacts()).toBeNull();
  });

  it("reports elapsed time from the last capture once stopped", async () => {
    const session = new BugSession({ screenRecorder: fakeRecorder() });

    await session.start();
    await session.stop("manual");

    expect(session.getElapsedMs()).toBe(session.getLastArtifacts()?.elapsedMs);
  });

  it("releases recorder and network resources on dispose", async () => {
    const recorder = fakeRecorder();
    const networkLogger = new NetworkLogger();
    const session = new BugSession({ screenRecorder: recorder, networkLogger });

    await session.start();
    await session.dispose();

    expect(recorder.dispose).toHaveBeenCalled();
    expect(networkLogger.isRecording()).toBe(false);
  });
});
