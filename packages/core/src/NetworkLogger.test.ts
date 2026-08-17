import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NetworkLogger } from "./NetworkLogger";
import { REDACTED } from "./privacy";

/** Minimal `fetch` stub that records nothing and always succeeds. */
function stubFetch(body = "{}", status = 200): typeof fetch {
  return vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
}

describe("NetworkLogger", () => {
  let logger: NetworkLogger;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = stubFetch();
  });

  afterEach(() => {
    logger?.stop();
    globalThis.fetch = originalFetch;
  });

  it("records method, status, and timing for a fetch call", async () => {
    logger = new NetworkLogger();
    logger.start();

    await fetch("https://api.example.com/orders", { method: "POST" });
    const [entry] = logger.stop();

    expect(entry.method).toBe("POST");
    expect(entry.url).toBe("https://api.example.com/orders");
    expect(entry.status).toBe(200);
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("redacts credentials from the logged URL", async () => {
    logger = new NetworkLogger();
    logger.start();

    await fetch("https://api.example.com/orders?access_token=sk_live_secret&page=1");
    const [entry] = logger.stop();

    expect(entry.url).not.toContain("sk_live_secret");
    expect(entry.url).toContain("page=1");
  });

  it("does not capture bodies unless asked", async () => {
    logger = new NetworkLogger();
    logger.start();

    await fetch("https://api.example.com/orders", {
      method: "POST",
      body: JSON.stringify({ note: "hello" }),
    });
    const [entry] = logger.stop();

    expect(entry.requestBody).toBeUndefined();
    expect(entry.responseBody).toBeUndefined();
  });

  it("redacts credential keys from captured request bodies", async () => {
    logger = new NetworkLogger({ captureRequestBodies: true });
    logger.start();

    await fetch("https://api.example.com/profile", {
      method: "POST",
      body: JSON.stringify({ email: "ali@example.com", password: "hunter2" }),
    });
    const [entry] = logger.stop();

    expect(entry.requestBody).toContain("ali@example.com");
    expect(entry.requestBody).toContain(REDACTED);
    expect(entry.requestBody).not.toContain("hunter2");
  });

  it("never captures bodies for authentication endpoints", async () => {
    // These exchange credentials in shapes key-name redaction cannot catch.
    logger = new NetworkLogger({ captureRequestBodies: true });
    logger.start();

    await fetch("https://api.example.com/auth/login", {
      method: "POST",
      body: JSON.stringify({ user: "ali", secretPhrase: "open sesame" }),
    });
    const [entry] = logger.stop();

    expect(entry.requestBody).toBeUndefined();
  });

  it("truncates bodies past the configured limit", async () => {
    logger = new NetworkLogger({ captureRequestBodies: true, maxBodySize: 20 });
    logger.start();

    await fetch("https://api.example.com/notes", {
      method: "POST",
      body: JSON.stringify({ note: "x".repeat(500) }),
    });
    const [entry] = logger.stop();

    expect(entry.requestBody).toContain("[truncated]");
    expect(entry.requestBody!.length).toBeLessThan(60);
  });

  it("honours the legacy redactBodyKeys option alongside the defaults", async () => {
    logger = new NetworkLogger({ captureRequestBodies: true, redactBodyKeys: ["nickname"] });
    logger.start();

    await fetch("https://api.example.com/profile", {
      method: "POST",
      body: JSON.stringify({ nickname: "shadow", password: "hunter2" }),
    });
    const [entry] = logger.stop();

    expect(entry.requestBody).not.toContain("shadow");
    expect(entry.requestBody).not.toContain("hunter2");
  });

  it("logs a failed request with a null status and rethrows", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;

    logger = new NetworkLogger();
    logger.start();

    await expect(fetch("https://api.example.com/down")).rejects.toThrow("Network request failed");

    const [entry] = logger.stop();
    expect(entry.status).toBeNull();
  });

  it("restores the original fetch on stop", () => {
    const stub = globalThis.fetch;

    logger = new NetworkLogger();
    logger.start();
    expect(globalThis.fetch).not.toBe(stub);

    logger.stop();
    expect(globalThis.fetch).toBe(stub);
  });

  it("keeps logs until cleared", async () => {
    logger = new NetworkLogger();
    logger.start();

    await fetch("https://api.example.com/a");
    logger.stop();

    expect(logger.getLogs()).toHaveLength(1);
    logger.clear();
    expect(logger.getLogs()).toHaveLength(0);
  });

  it("reports recording state accurately", () => {
    logger = new NetworkLogger();
    expect(logger.isRecording()).toBe(false);

    logger.start();
    expect(logger.isRecording()).toBe(true);

    logger.stop();
    expect(logger.isRecording()).toBe(false);
  });

  it("restores XMLHttpRequest prototype methods on stop", () => {
    const open = XMLHttpRequest.prototype.open;
    const send = XMLHttpRequest.prototype.send;

    logger = new NetworkLogger();
    logger.start();
    expect(XMLHttpRequest.prototype.open).not.toBe(open);

    logger.stop();
    expect(XMLHttpRequest.prototype.open).toBe(open);
    expect(XMLHttpRequest.prototype.send).toBe(send);
  });
});
