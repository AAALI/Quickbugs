import { describe, expect, it } from "vitest";

import {
  DEFAULT_MASK_SELECTORS,
  DEFAULT_REDACT_KEYS,
  PATH_ELISION,
  REDACTED,
  redactJson,
  redactUrl,
  redactValue,
  resolvePrivacy,
  truncate,
} from "./privacy";

describe("resolvePrivacy", () => {
  it("masks credentials and payment fields with no configuration", () => {
    const privacy = resolvePrivacy();

    expect(privacy.maskSelectors).toContain('input[type="password"]');
    expect(privacy.maskSelectors).toContain('input[autocomplete="one-time-code"]');
    expect(privacy.maskSelectors).toContain('input[autocomplete^="cc-"]');
    expect(privacy.redactLogKeys).toContain("password");
    expect(privacy.redactLogKeys).toContain("token");
  });

  it("adds caller selectors to the defaults rather than replacing them", () => {
    const privacy = resolvePrivacy({ maskSelectors: [".invoice-total"] });

    expect(privacy.maskSelectors).toContain(".invoice-total");
    for (const builtin of DEFAULT_MASK_SELECTORS) {
      expect(privacy.maskSelectors).toContain(builtin);
    }
  });

  it("de-duplicates case-insensitively so a repeated key is listed once", () => {
    const privacy = resolvePrivacy({ redactLogKeys: ["PASSWORD", "password"] });

    const passwordEntries = privacy.redactLogKeys.filter((key) => key.toLowerCase() === "password");
    expect(passwordEntries).toHaveLength(1);
  });

  it("drops every built-in only when defaults are explicitly disabled", () => {
    const privacy = resolvePrivacy({ disableDefaultMasking: true, maskSelectors: [".mine"] });

    expect(privacy.maskSelectors).toEqual([".mine"]);
    expect(privacy.redactLogKeys).toEqual([]);
  });
});

describe("redactUrl", () => {
  const privacy = resolvePrivacy();

  it("redacts credential-bearing query parameters", () => {
    const result = redactUrl("https://app.example.com/orders?access_token=sk_live_abc&page=2", privacy);

    expect(result).toContain(`access_token=${encodeURIComponent(REDACTED)}`);
    expect(result).not.toContain("sk_live_abc");
    expect(result).toContain("page=2");
  });

  it("redacts OAuth credentials returned in the fragment", () => {
    // Implicit-flow tokens never reach a server log, but they do sit in
    // location.href where the SDK would otherwise capture them.
    const result = redactUrl("https://app.example.com/cb#access_token=abc123&scope=read", privacy);

    expect(result).not.toContain("abc123");
    expect(result).toContain("scope=read");
  });

  it("leaves a plain anchor fragment untouched", () => {
    expect(redactUrl("https://example.com/docs#installation", privacy)).toBe(
      "https://example.com/docs#installation",
    );
  });

  it("matches short credential parameters exactly, not as substrings", () => {
    const result = redactUrl("https://example.com/?code=oauth_secret&country_code=AE", privacy);

    expect(result).not.toContain("oauth_secret");
    expect(result).toContain("country_code=AE");
  });

  it("preserves relative URLs as relative", () => {
    const result = redactUrl("/api/orders?api_key=secret123", privacy);

    expect(result.startsWith("/api/orders")).toBe(true);
    expect(result).not.toContain("secret123");
  });

  it("truncates the path when urlDepth is set", () => {
    const shallow = resolvePrivacy({ urlDepth: 1 });

    expect(redactUrl("https://example.com/users/12345/orders/98765", shallow)).toBe(
      `https://example.com/users/${PATH_ELISION}`,
    );
  });

  it("returns unparseable input unchanged rather than throwing", () => {
    expect(redactUrl("http://[not a url", privacy)).toBe("http://[not a url");
    expect(redactUrl("", privacy)).toBe("");
  });
});

describe("redactJson", () => {
  const keys = DEFAULT_REDACT_KEYS;

  it("redacts matching keys at any depth", () => {
    const input = JSON.stringify({
      email: "ali@example.com",
      account: { password: "hunter2", nested: { refresh_token: "rt_abc" } },
    });

    const result = JSON.parse(redactJson(input, keys));

    expect(result.email).toBe("ali@example.com");
    expect(result.account.password).toBe(REDACTED);
    expect(result.account.nested.refresh_token).toBe(REDACTED);
  });

  it("redacts matching keys inside arrays", () => {
    const input = JSON.stringify({ users: [{ name: "Ali", apiKey: "k_1" }] });

    const result = JSON.parse(redactJson(input, keys));

    expect(result.users[0].name).toBe("Ali");
    expect(result.users[0].apiKey).toBe(REDACTED);
  });

  it("returns non-JSON bodies unchanged", () => {
    // A body we cannot parse is one we cannot safely rewrite.
    expect(redactJson("<html>not json</html>", keys)).toBe("<html>not json</html>");
  });

  it("is a no-op when no keys are configured", () => {
    expect(redactJson('{"password":"hunter2"}', [])).toBe('{"password":"hunter2"}');
  });
});

describe("redactValue", () => {
  it("does not mutate the value it was given", () => {
    // The caller may still own the request body we are observing.
    const original = { password: "hunter2", nested: { token: "t" } };

    const result = redactValue(original, ["password", "token"]) as typeof original;

    expect(original.password).toBe("hunter2");
    expect(original.nested.token).toBe("t");
    expect(result.password).toBe(REDACTED);
  });

  it("passes primitives through untouched", () => {
    expect(redactValue(42, ["token"])).toBe(42);
    expect(redactValue(null, ["token"])).toBeNull();
  });
});

describe("truncate", () => {
  it("flags that content was dropped", () => {
    expect(truncate("abcdef", 3)).toBe("abc…[truncated]");
  });

  it("leaves text within the limit alone", () => {
    expect(truncate("abc", 3)).toBe("abc");
  });
});
