/**
 * Report identifiers.
 *
 * Each capture gets an id at the moment its artifacts are created, not at
 * submit time. That distinction is what makes retries safe: a submission that
 * times out can be sent again with the same id, and the server recognises it as
 * the same report instead of creating a duplicate. The user never re-records.
 */

/** Hex characters, used by the fallback generator. */
const HEX = "0123456789abcdef";

/**
 * Generate a report id.
 *
 * Prefers `crypto.randomUUID`, falling back to `crypto.getRandomValues` and
 * finally to `Math.random`. The fallbacks matter more than they look:
 * `randomUUID` is only exposed in secure contexts, so a team testing on a plain
 * `http://` staging host would otherwise crash on capture. Collision resistance
 * here only needs to hold within a single project, and the value is never used
 * as a security token.
 */
export function createReportId(): string {
  const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));

    // Set the version and variant bits so the result is a well-formed UUIDv4.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    return formatUuid([...bytes]);
  }

  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return formatUuid(bytes);
}

/** Render 16 bytes in canonical 8-4-4-4-12 UUID form. */
function formatUuid(bytes: number[]): string {
  const hex = bytes.map((byte) => HEX[(byte >> 4) & 0x0f] + HEX[byte & 0x0f]).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
