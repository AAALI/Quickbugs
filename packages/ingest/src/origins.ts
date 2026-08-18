/**
 * Origin allow-listing.
 *
 * A project key ships inside the customer's browser bundle, so it is public by
 * construction — anyone can read it out of the page. The origin allow-list is
 * what stops a scraped key being used to flood a project with junk from
 * somewhere else. It is a spend control, not an authentication mechanism, and
 * should never be described as one: a determined attacker forges the header.
 */

import { IngestError } from "./errors";

/**
 * Match an origin against one allow-list entry.
 *
 * Supports an exact origin (`https://app.example.com`), a single-label wildcard
 * (`https://*.example.com`), and `*` for projects that deliberately accept any
 * origin. The wildcard matches one label only: `https://*.example.com` allows
 * `https://app.example.com` but not `https://a.b.example.com`, because a
 * customer allow-listing their app subdomain rarely means to include every
 * nested subdomain a third party might control.
 */
export function originMatches(origin: string, pattern: string): boolean {
  if (pattern === "*") {
    return true;
  }

  const normalizedOrigin = origin.trim().toLowerCase().replace(/\/$/, "");
  const normalizedPattern = pattern.trim().toLowerCase().replace(/\/$/, "");

  if (!normalizedPattern.includes("*")) {
    return normalizedOrigin === normalizedPattern;
  }

  const [scheme, host] = splitOrigin(normalizedPattern);
  const [originScheme, originHost] = splitOrigin(normalizedOrigin);

  if (!scheme || !host || !originScheme || !originHost || scheme !== originScheme) {
    return false;
  }

  if (!host.startsWith("*.")) {
    return false;
  }

  const suffix = host.slice(1); // ".example.com"
  if (!originHost.endsWith(suffix)) {
    return false;
  }

  const label = originHost.slice(0, -suffix.length);
  return label.length > 0 && !label.includes(".");
}

/** Split an origin into scheme and host, tolerating malformed input. */
function splitOrigin(value: string): [string | null, string | null] {
  const separator = value.indexOf("://");

  if (separator === -1) {
    return [null, null];
  }

  return [value.slice(0, separator), value.slice(separator + 3)];
}

/**
 * Reject a request whose `Origin` is not on the project's allow-list.
 *
 * An empty allow-list accepts everything. That is the right default for a
 * project that has not been configured yet — refusing reports from a customer
 * who has not found the setting yet loses data and teaches them nothing.
 *
 * A request with no `Origin` header at all is allowed through: server-to-server
 * replays and some privacy tooling strip it, and the header is trivially forged
 * anyway, so blocking on its absence costs real reports and buys nothing.
 *
 * @throws {IngestError} `origin_not_allowed` when the header is present and
 * matches no entry.
 */
export function assertOriginAllowed(origin: string | null, allowedOrigins: string[]): void {
  if (allowedOrigins.length === 0 || !origin) {
    return;
  }

  if (allowedOrigins.some((pattern) => originMatches(origin, pattern))) {
    return;
  }

  throw new IngestError(
    "origin_not_allowed",
    `Origin "${origin}" is not in this project's allowed origins. Add it in project settings.`,
  );
}

/**
 * Build CORS headers for a browser-submitted report.
 *
 * The SDK posts from a page on the customer's domain, so the response must
 * echo an allowed origin — a wildcard would work here but reflecting the exact
 * origin keeps the response honest about what was accepted.
 */
export function corsHeaders(origin: string | null, allowedOrigins: string[]): Record<string, string> {
  const permitted =
    !origin || allowedOrigins.length === 0 || allowedOrigins.some((p) => originMatches(origin, p));

  return {
    "Access-Control-Allow-Origin": permitted && origin ? origin : "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
