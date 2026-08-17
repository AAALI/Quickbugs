import { describe, expect, it } from "vitest";

import {
  formatConsoleLogs,
  formatJsErrors,
  formatNetworkLogs,
  toBlobFile,
  toErrorMessage,
  toRecordingFile,
  toScreenshotFile,
} from "./types";

describe("formatConsoleLogs", () => {
  it("says so plainly when nothing was captured", () => {
    expect(formatConsoleLogs([])).toBe("No console output captured.");
  });

  it("renders level, timestamp, and joined arguments", () => {
    const output = formatConsoleLogs([
      { level: "error", timestamp: "2026-08-17T10:00:00.000Z", args: ["Payment failed", "429"] },
    ]);

    expect(output).toContain("ERROR");
    expect(output).toContain("2026-08-17T10:00:00.000Z");
    expect(output).toContain("Payment failed 429");
  });
});

describe("formatJsErrors", () => {
  it("says so plainly when nothing was captured", () => {
    expect(formatJsErrors([])).toBe("No JavaScript errors captured.");
  });

  it("includes source location and stack when present", () => {
    const output = formatJsErrors([
      {
        timestamp: "2026-08-17T10:00:00.000Z",
        message: "undefined is not a function",
        source: "app.js",
        lineno: 42,
        colno: 7,
        stack: "at pay (app.js:42:7)",
        type: "error",
      },
    ]);

    expect(output).toContain("undefined is not a function");
    expect(output).toContain("app.js:42:7");
    expect(output).toContain("at pay");
  });

  it("omits location details that were not captured", () => {
    const output = formatJsErrors([
      { timestamp: "2026-08-17T10:00:00.000Z", message: "boom", type: "unhandledrejection" },
    ]);

    expect(output).toContain("unhandledrejection: boom");
    expect(output).not.toContain("  at ");
  });
});

describe("formatNetworkLogs", () => {
  it("says so plainly when nothing was captured", () => {
    expect(formatNetworkLogs([])).toBe("No network requests captured.");
  });

  it("marks a request with no status as failed", () => {
    const output = formatNetworkLogs([
      {
        method: "get",
        url: "https://api.example.com/orders",
        status: null,
        durationMs: 120,
        timestamp: "2026-08-17T10:00:00.000Z",
      },
    ]);

    expect(output).toContain("GET https://api.example.com/orders -> FAILED (120ms)");
  });

  it("includes captured bodies on their own lines", () => {
    const output = formatNetworkLogs([
      {
        method: "POST",
        url: "https://api.example.com/orders",
        status: 500,
        durationMs: 90,
        timestamp: "2026-08-17T10:00:00.000Z",
        requestBody: '{"id":1}',
        responseBody: '{"error":"boom"}',
      },
    ]);

    expect(output).toContain("Request Body: {\"id\":1}");
    expect(output).toContain("Response Body: {\"error\":\"boom\"}");
  });
});

describe("toErrorMessage", () => {
  it("uses the error's own message", () => {
    expect(toErrorMessage(new Error("Upload failed"))).toBe("Upload failed");
  });

  it("falls back for non-errors and blank messages", () => {
    expect(toErrorMessage(new Error("   "))).toBe("Unknown error");
    expect(toErrorMessage("a string")).toBe("Unknown error");
    expect(toErrorMessage(undefined)).toBe("Unknown error");
  });
});

describe("file helpers", () => {
  it("keeps the blob's own type when it has one", () => {
    const file = toBlobFile(new Blob(["x"], { type: "image/webp" }), "shot.webp", "image/png");

    expect(file.type).toBe("image/webp");
    expect(file.name).toBe("shot.webp");
  });

  it("falls back to the provided type for a typeless blob", () => {
    expect(toBlobFile(new Blob(["x"]), "shot.png", "image/png").type).toBe("image/png");
  });

  it("applies conventional names and types by default", () => {
    expect(toRecordingFile(new Blob(["x"])).name).toBe("bug-recording.webm");
    expect(toRecordingFile(new Blob(["x"])).type).toBe("video/webm");
    expect(toScreenshotFile(new Blob(["x"])).name).toBe("bug-screenshot.png");
    expect(toScreenshotFile(new Blob(["x"])).type).toBe("image/png");
  });
});
