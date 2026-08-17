import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConsoleCapture } from "./ConsoleCapture";

describe("ConsoleCapture", () => {
  let capture: ConsoleCapture | null = null;

  beforeEach(() => {
    // ConsoleCapture forwards to the real console by design, which would dump
    // every fixture line into the test report. Silence the sink, not the
    // forwarding — these spies are what the passthrough test asserts against.
    for (const level of ["log", "info", "warn", "error"] as const) {
      vi.spyOn(console, level).mockImplementation(() => {});
    }
  });

  afterEach(() => {
    capture?.stop();
    capture = null;
  });

  it("records each console level it patches", () => {
    capture = new ConsoleCapture();
    capture.start();

    console.log("plain");
    console.info("informational");
    console.warn("careful");
    console.error("broken");

    const levels = capture.snapshot().consoleLogs.map((entry) => entry.level);
    expect(levels).toEqual(["log", "info", "warn", "error"]);
  });

  it("still forwards to the original console", () => {
    const spy = console.log as unknown as ReturnType<typeof vi.fn>;

    capture = new ConsoleCapture();
    capture.start();
    console.log("passthrough");

    expect(spy).toHaveBeenCalledWith("passthrough");
  });

  it("serializes objects and truncates very long arguments", () => {
    capture = new ConsoleCapture();
    capture.start();

    console.log({ order: 42 });
    console.log("x".repeat(5000));

    const [structured, long] = capture.snapshot().consoleLogs;
    expect(structured.args[0]).toBe('{"order":42}');
    expect(long.args[0].length).toBeLessThan(1100);
    expect(long.args[0].endsWith("…")).toBe(true);
  });

  it("keeps a bounded buffer so a chatty page cannot exhaust memory", () => {
    capture = new ConsoleCapture();
    capture.start();

    for (let i = 0; i < 250; i += 1) {
      console.log(`entry-${i}`);
    }

    const logs = capture.snapshot().consoleLogs;
    expect(logs).toHaveLength(200);
    // The oldest entries are the ones dropped.
    expect(logs[logs.length - 1].args[0]).toBe("entry-249");
  });

  it("captures uncaught errors with their stack", () => {
    capture = new ConsoleCapture();
    capture.start();

    const error = new Error("undefined is not a function");
    window.dispatchEvent(
      new ErrorEvent("error", { message: error.message, filename: "app.js", lineno: 42, error }),
    );

    const [captured] = capture.snapshot().jsErrors;
    expect(captured.message).toBe("undefined is not a function");
    expect(captured.source).toBe("app.js");
    expect(captured.type).toBe("error");
  });

  it("restores the original console methods on stop", () => {
    const original = console.log;

    capture = new ConsoleCapture();
    capture.start();
    expect(console.log).not.toBe(original);

    capture.stop();
    expect(console.log).toBe(original);
  });

  it("clears buffered output on request", () => {
    capture = new ConsoleCapture();
    capture.start();
    console.log("before");

    capture.clear();

    expect(capture.snapshot().consoleLogs).toHaveLength(0);
  });

  it("ignores a repeated start", () => {
    capture = new ConsoleCapture();
    capture.start();
    const patched = console.log;

    capture.start();

    expect(console.log).toBe(patched);
  });
});
