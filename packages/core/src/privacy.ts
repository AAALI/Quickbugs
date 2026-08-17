/**
 * Privacy defaults and redaction helpers.
 *
 * One rule governs this module: a bug report must never carry a credential.
 * Every default here is chosen so an integrator who configures nothing still
 * gets safe capture. Configuration adds to the protected set — it never
 * silently shrinks it. The single exception is `disableDefaultMasking`, which
 * is explicit, documented as unsafe, and never inferred.
 */

/**
 * Elements blurred out of screenshots by default.
 *
 * Covers the three things that actually end careers when they leak: passwords,
 * one-time codes, and payment instruments. Third-party payment iframes are
 * included because their contents are cross-origin and would otherwise render
 * as an opaque box we cannot reason about.
 */
export const DEFAULT_MASK_SELECTORS: readonly string[] = [
  // Credentials
  'input[type="password"]',
  'input[autocomplete="current-password"]',
  'input[autocomplete="new-password"]',
  'input[autocomplete="one-time-code"]',
  // Payment instruments
  'input[autocomplete^="cc-"]',
  'input[name*="cardnumber" i]',
  'input[name*="creditcard" i]',
  'input[name*="cvc" i]',
  'input[name*="cvv" i]',
  // Hosted payment fields
  'iframe[src*="js.stripe.com"]',
  'iframe[src*="checkout.stripe.com"]',
  'iframe[name*="__privateStripeFrame"]',
  // Integrator opt-in
  "[data-quickbugs-mask]",
];

/**
 * Elements replaced with a solid placeholder by default.
 *
 * Blocking is destructive, so the default set is limited to an explicit opt-in
 * attribute. Anything we are unsure about gets masked instead.
 */
export const DEFAULT_BLOCK_SELECTORS: readonly string[] = ["[data-quickbugs-block]"];

/**
 * Object keys whose values are stripped from captured request and response
 * bodies.
 *
 * Matching is case-insensitive **substring** matching, so short stems cover
 * their variants: `token` catches `accessToken` and `refresh_token`, and `auth`
 * catches `authorization` and `oauthState`. Keep entries short for that reason.
 */
export const DEFAULT_REDACT_KEYS: readonly string[] = [
  "auth",
  "token",
  "password",
  "passwd",
  "secret",
  "apikey",
  "api_key",
  "credential",
  "session",
  "cookie",
  "otp",
  "cvv",
  "cvc",
  "cardnumber",
  "card_number",
  "ssn",
  "privatekey",
  "private_key",
];

/**
 * Query/fragment parameters redacted from logged URLs by substring match.
 *
 * Same substring semantics as {@link DEFAULT_REDACT_KEYS}.
 */
export const DEFAULT_REDACT_QUERY_SUBSTRINGS: readonly string[] = [
  "auth",
  "token",
  "password",
  "secret",
  "apikey",
  "api_key",
  "session",
  "credential",
  "signature",
];

/**
 * Query/fragment parameters redacted from logged URLs by exact match.
 *
 * These are real credentials in OAuth and signed-URL flows but are short enough
 * that substring matching would eat innocent parameters — `code` would swallow
 * `country_code`, `sig` would swallow `design`.
 */
export const DEFAULT_REDACT_QUERY_EXACT: readonly string[] = [
  "code",
  "sig",
  "state",
  "key",
  "pin",
  "jwt",
  "id_token",
];

/** Replacement written in place of any redacted value. */
export const REDACTED = "[REDACTED]";

/** Marker left where `urlDepth` elides trailing path segments. */
export const PATH_ELISION = "...";

/** Placeholder base used to parse relative URLs. Never surfaces in output. */
const RELATIVE_URL_BASE = "http://quickbugs.invalid";

export type PrivacyOptions = {
  /** Selectors blurred in screenshots, added to {@link DEFAULT_MASK_SELECTORS}. */
  maskSelectors?: string[];
  /** Selectors replaced with a placeholder, added to {@link DEFAULT_BLOCK_SELECTORS}. */
  blockSelectors?: string[];
  /** Body/metadata keys redacted, added to {@link DEFAULT_REDACT_KEYS}. */
  redactLogKeys?: string[];
  /**
   * Keep only the first N path segments of logged URLs. Useful when path
   * segments carry identifiers (`/users/12345/orders/98765`). Omit to keep the
   * full path.
   */
  urlDepth?: number;
  /**
   * Opt out of every built-in default above. Leaves only the selectors and keys
   * you supply.
   *
   * @remarks Unsafe. Passwords and card numbers will be captured verbatim
   * unless your own selectors cover them.
   */
  disableDefaultMasking?: boolean;
};

/** Privacy configuration with every default resolved. */
export type ResolvedPrivacy = {
  maskSelectors: string[];
  blockSelectors: string[];
  redactLogKeys: string[];
  redactQuerySubstrings: string[];
  redactQueryExact: string[];
  urlDepth?: number;
};

/** Case-insensitive de-duplicating merge that preserves first-seen order. */
function mergeUnique(base: readonly string[], extra: readonly string[] = []): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const value of [...base, ...extra]) {
    const key = value.toLowerCase();
    if (value.length > 0 && !seen.has(key)) {
      seen.add(key);
      merged.push(value);
    }
  }

  return merged;
}

/**
 * Merge integrator options over the built-in defaults.
 *
 * Supplied values are added to the defaults rather than replacing them, so a
 * partial configuration can never widen what gets captured.
 */
export function resolvePrivacy(options: PrivacyOptions = {}): ResolvedPrivacy {
  const useDefaults = !options.disableDefaultMasking;

  return {
    maskSelectors: mergeUnique(useDefaults ? DEFAULT_MASK_SELECTORS : [], options.maskSelectors),
    blockSelectors: mergeUnique(useDefaults ? DEFAULT_BLOCK_SELECTORS : [], options.blockSelectors),
    redactLogKeys: mergeUnique(useDefaults ? DEFAULT_REDACT_KEYS : [], options.redactLogKeys),
    redactQuerySubstrings: mergeUnique(useDefaults ? DEFAULT_REDACT_QUERY_SUBSTRINGS : []),
    redactQueryExact: mergeUnique(useDefaults ? DEFAULT_REDACT_QUERY_EXACT : []),
    urlDepth: options.urlDepth,
  };
}

/** Whether a parameter or property name matches the configured redaction rules. */
function matchesRedactionRule(
  name: string,
  substrings: readonly string[],
  exact: readonly string[] = [],
): boolean {
  const lower = name.toLowerCase();
  return (
    exact.some((entry) => lower === entry.toLowerCase()) ||
    substrings.some((entry) => lower.includes(entry.toLowerCase()))
  );
}

/**
 * Redact credential-bearing parameters from a URL, in both the query string and
 * the fragment.
 *
 * The fragment matters as much as the query: OAuth implicit flows return
 * `#access_token=…`, which never reaches a server log but sits in
 * `location.href` where we would otherwise capture it.
 *
 * @param url - Absolute or relative URL. Unparseable input is returned as-is.
 * @param privacy - Resolved privacy configuration.
 * @returns The URL with matched parameter values replaced by {@link REDACTED},
 * and the path truncated when `urlDepth` is set.
 */
export function redactUrl(url: string, privacy: ResolvedPrivacy): string {
  if (!url) {
    return url;
  }

  const isRelative = !/^[a-z][a-z0-9+.-]*:/i.test(url);

  let parsed: URL;
  try {
    parsed = new URL(url, isRelative ? RELATIVE_URL_BASE : undefined);
  } catch {
    return url;
  }

  for (const key of [...parsed.searchParams.keys()]) {
    if (matchesRedactionRule(key, privacy.redactQuerySubstrings, privacy.redactQueryExact)) {
      parsed.searchParams.set(key, REDACTED);
    }
  }

  parsed.hash = redactFragment(parsed.hash, privacy);

  if (typeof privacy.urlDepth === "number" && privacy.urlDepth >= 0) {
    parsed.pathname = truncatePath(parsed.pathname, privacy.urlDepth);
  }

  const result = parsed.toString();
  return isRelative ? result.slice(RELATIVE_URL_BASE.length) : result;
}

/**
 * Redact a URL fragment that encodes parameters, leaving plain anchors alone.
 *
 * `#access_token=abc&scope=read` is credential-bearing; `#section-3` is not.
 */
function redactFragment(hash: string, privacy: ResolvedPrivacy): string {
  if (!hash || !hash.includes("=")) {
    return hash;
  }

  const params = new URLSearchParams(hash.slice(1));

  for (const key of [...params.keys()]) {
    if (matchesRedactionRule(key, privacy.redactQuerySubstrings, privacy.redactQueryExact)) {
      params.set(key, REDACTED);
    }
  }

  return `#${params.toString()}`;
}

/**
 * Keep only the first `depth` path segments, marking the rest as elided.
 *
 * The marker is ASCII because assigning to `URL.pathname` percent-encodes
 * anything else — a `…` would reach the reader as `%E2%80%A6`.
 */
function truncatePath(pathname: string, depth: number): string {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= depth) {
    return pathname;
  }

  return `/${segments.slice(0, depth).join("/")}${depth > 0 ? "/" : ""}${PATH_ELISION}`;
}

/**
 * Redact matching properties in a JSON document.
 *
 * @param text - JSON text. Non-JSON input is returned unchanged, since a body
 * we cannot parse is one we cannot safely rewrite.
 * @param keys - Substring keys identifying properties to redact.
 * @returns JSON text with matched values replaced by {@link REDACTED}.
 */
export function redactJson(text: string, keys: readonly string[]): string {
  if (keys.length === 0) {
    return text;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    return JSON.stringify(redactValue(parsed, keys));
  } catch {
    return text;
  }
}

/**
 * Recursively copy a value, replacing properties whose names match `keys`.
 *
 * Returns a new structure rather than mutating in place — the caller may be
 * holding a body the host application still owns, and rewriting it underneath
 * them would corrupt the very request we are observing.
 */
export function redactValue(value: unknown, keys: readonly string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, keys));
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(source)) {
    result[key] = matchesRedactionRule(key, keys) ? REDACTED : redactValue(source[key], keys);
  }

  return result;
}

/** Truncate text to `max` characters, flagging that content was dropped. */
export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…[truncated]` : text;
}
