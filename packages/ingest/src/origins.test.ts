import { describe, expect, it } from "vitest";

import { isIngestError } from "./errors";
import { assertOriginAllowed, corsHeaders, originMatches } from "./origins";

describe("originMatches", () => {
  it("matches an exact origin", () => {
    expect(originMatches("https://app.example.com", "https://app.example.com")).toBe(true);
    expect(originMatches("https://evil.example.com", "https://app.example.com")).toBe(false);
  });

  it("distinguishes scheme and port", () => {
    expect(originMatches("http://app.example.com", "https://app.example.com")).toBe(false);
    expect(originMatches("https://app.example.com:8443", "https://app.example.com")).toBe(false);
  });

  it("ignores case and a trailing slash", () => {
    expect(originMatches("https://APP.example.com/", "https://app.example.com")).toBe(true);
  });

  it("matches a single subdomain label with a wildcard", () => {
    expect(originMatches("https://app.example.com", "https://*.example.com")).toBe(true);
    expect(originMatches("https://staging.example.com", "https://*.example.com")).toBe(true);
  });

  it("does not let a wildcard span multiple labels", () => {
    // https://*.example.com must not admit an origin a third party controls
    // deeper in the tree.
    expect(originMatches("https://a.b.example.com", "https://*.example.com")).toBe(false);
  });

  it("does not let a wildcard match the bare domain", () => {
    expect(originMatches("https://example.com", "https://*.example.com")).toBe(false);
  });

  it("does not let a wildcard match a lookalike suffix", () => {
    expect(originMatches("https://app.notexample.com", "https://*.example.com")).toBe(false);
    expect(originMatches("https://evil-example.com", "https://*.example.com")).toBe(false);
  });

  it("accepts everything for the bare wildcard", () => {
    expect(originMatches("https://anything.test", "*")).toBe(true);
  });

  it("rejects a malformed pattern rather than matching loosely", () => {
    expect(originMatches("https://app.example.com", "*.example.com")).toBe(false);
  });
});

describe("assertOriginAllowed", () => {
  it("accepts any origin when the project has configured none", () => {
    expect(() => assertOriginAllowed("https://anywhere.test", [])).not.toThrow();
  });

  it("accepts a request with no Origin header", () => {
    // Server-to-server replays and some privacy tooling strip it, and the
    // header is forgeable anyway — blocking on absence loses real reports.
    expect(() => assertOriginAllowed(null, ["https://app.example.com"])).not.toThrow();
  });

  it("accepts an allow-listed origin", () => {
    expect(() =>
      assertOriginAllowed("https://app.example.com", ["https://app.example.com"]),
    ).not.toThrow();
  });

  it("rejects an origin that matches nothing", () => {
    try {
      assertOriginAllowed("https://evil.test", ["https://app.example.com"]);
    } catch (error) {
      expect(isIngestError(error) && error.code).toBe("origin_not_allowed");
      expect(isIngestError(error) && error.status).toBe(403);
      expect(isIngestError(error) && error.retryable).toBe(false);
      return;
    }

    throw new Error("Expected the origin to be rejected.");
  });
});

describe("corsHeaders", () => {
  it("reflects an allowed origin", () => {
    const headers = corsHeaders("https://app.example.com", ["https://app.example.com"]);

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.example.com");
    expect(headers.Vary).toBe("Origin");
  });

  it("does not reflect a disallowed origin", () => {
    const headers = corsHeaders("https://evil.test", ["https://app.example.com"]);

    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("allows the POST and preflight the SDK performs", () => {
    const headers = corsHeaders(null, []);

    expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
    expect(headers["Access-Control-Allow-Methods"]).toContain("OPTIONS");
  });
});
