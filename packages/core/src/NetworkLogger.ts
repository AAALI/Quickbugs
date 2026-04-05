import { NetworkLogEntry } from "./types";

export type NetworkLoggerOptions = {
  captureRequestBodies?: boolean;
  captureResponseBodies?: boolean;
  maxBodySize?: number;
  redactBodyKeys?: string[];
};

const DEFAULT_MAX_BODY_SIZE = 10_000;
const DEFAULT_REDACT_KEYS = ["password", "token", "authorization"];
const AUTH_PATH_PATTERNS = ["/auth/", "/login", "/token"];

/**
 * Determine the HTTP method to use for a fetch request.
 *
 * @param input - The original request input (may be a `Request`, `URL`, or other value) used to derive a fallback method.
 * @param init - Optional init object whose `method` property, if present, overrides the method from `input`.
 * @returns The resolved HTTP method string (for example, `"GET"` or `"POST"`).
 */
function resolveMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return init.method;
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method;
  }

  return "GET";
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (typeof URL !== "undefined" && input instanceof URL) {
    return input.toString();
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.url;
  }

  return String(input);
}

/**
 * Returns a millisecond timestamp suitable for measuring elapsed time.
 *
 * @returns A number of milliseconds usable to compute durations. When available the value is from `performance.now()` (high-resolution, relative to the page/navigation start); otherwise it is from `Date.now()` (milliseconds since the UNIX epoch).
 */
function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

/**
 * Determines whether a URL matches known authentication-related path patterns.
 *
 * Performs a case-insensitive substring check against configured authentication path patterns.
 *
 * @returns `true` if the URL contains any authentication path pattern, `false` otherwise.
 */
function isAuthUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return AUTH_PATH_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Redacts values in a JSON string for object properties whose names match any provided substrings.
 *
 * Parses `text` as JSON, replaces values of properties whose key name contains any entry from `keys`
 * (case-insensitive substring match) with `"[REDACTED]"`, and returns the resulting JSON string.
 *
 * @param text - The JSON string to redact
 * @param keys - Substring keys used to identify property names to redact (case-insensitive)
 * @returns The JSON string with matching values replaced by `"[REDACTED]"`, or the original `text` if `keys` is empty or parsing/stringification fails
 */
function redactJson(text: string, keys: string[]): string {
  if (keys.length === 0) return text;
  try {
    const obj = JSON.parse(text);
    redactObject(obj, keys);
    return JSON.stringify(obj);
  } catch {
    return text;
  }
}

/**
 * Recursively redacts properties whose key names contain any of the provided substrings.
 *
 * Walks objects and arrays in-place, replacing a property value with `"[REDACTED]"` when the property's key contains (case-insensitive substring match) any entry from `keys`. Non-object values are ignored.
 *
 * @param obj - The value to traverse and redact; only plain objects and arrays are modified in-place.
 * @param keys - Substring keys to match against object property names (case-insensitive).
 */
function redactObject(obj: unknown, keys: string[]): void {
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) redactObject(item, keys);
    return;
  }
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (keys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      (obj as Record<string, unknown>)[key] = "[REDACTED]";
    } else {
      redactObject((obj as Record<string, unknown>)[key], keys);
    }
  }
}

/**
 * Truncates a string to a maximum length and appends an indicator when truncated.
 *
 * @param text - The input string to truncate
 * @param max - Maximum allowed length of the returned string
 * @returns The original `text` if its length is less than or equal to `max`, otherwise the first `max` characters followed by "…[truncated]"
 */
function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…[truncated]" : text;
}

/**
 * Determines whether an HTTP method typically includes a request body.
 *
 * @param method - The HTTP method name
 * @returns `true` if `method` is `POST`, `PUT`, or `PATCH` (case-insensitive), `false` otherwise.
 */
function hasBody(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH";
}

export class NetworkLogger {
  private originalFetch: typeof fetch | null = null;
  private originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalXhrSend: typeof XMLHttpRequest.prototype.send | null = null;
  private logs: NetworkLogEntry[] = [];
  private recording = false;
  private options: Required<NetworkLoggerOptions>;

  constructor(options: NetworkLoggerOptions = {}) {
    this.options = {
      captureRequestBodies: options.captureRequestBodies ?? false,
      captureResponseBodies: options.captureResponseBodies ?? false,
      maxBodySize: options.maxBodySize ?? DEFAULT_MAX_BODY_SIZE,
      redactBodyKeys: options.redactBodyKeys ?? DEFAULT_REDACT_KEYS,
    };
  }

  start(): void {
    if (this.recording) {
      return;
    }

    this.interceptFetch();
    this.interceptXhr();
    this.recording = true;
  }

  stop(): NetworkLogEntry[] {
    if (!this.recording) {
      return this.getLogs();
    }

    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }

    this.restoreXhr();
    this.recording = false;

    return this.getLogs();
  }

  clear(): void {
    this.logs = [];
  }

  getLogs(): NetworkLogEntry[] {
    return [...this.logs];
  }

  isRecording(): boolean {
    return this.recording;
  }

  // --- Fetch interception ---

  private interceptFetch(): void {
    if (typeof globalThis.fetch !== "function") {
      return;
    }

    this.originalFetch = globalThis.fetch;
    const originalFetch = this.originalFetch;
    const self = this;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const started = nowMs();
      const method = resolveMethod(input, init);
      const url = resolveUrl(input);
      const timestamp = new Date().toISOString();
      const shouldCaptureBody = !isAuthUrl(url);

      let requestBody: string | undefined;
      if (self.options.captureRequestBodies && shouldCaptureBody && hasBody(method) && init?.body) {
        try {
          const raw = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
          requestBody = truncate(
            redactJson(raw, self.options.redactBodyKeys),
            self.options.maxBodySize,
          );
        } catch {
          // skip body capture
        }
      }

      try {
        const response = await originalFetch.call(globalThis, input, init);

        let responseBody: string | undefined;
        if (self.options.captureResponseBodies && shouldCaptureBody) {
          try {
            const clone = response.clone();
            const text = await clone.text();
            responseBody = truncate(
              redactJson(text, self.options.redactBodyKeys),
              self.options.maxBodySize,
            );
          } catch {
            // skip body capture
          }
        }

        const entry: NetworkLogEntry = {
          method,
          url,
          status: response.status,
          durationMs: Math.max(0, Math.round(nowMs() - started)),
          timestamp,
        };
        if (requestBody !== undefined) entry.requestBody = requestBody;
        if (responseBody !== undefined) entry.responseBody = responseBody;

        self.logs.push(entry);
        return response;
      } catch (error) {
        self.logs.push({
          method,
          url,
          status: null,
          durationMs: Math.max(0, Math.round(nowMs() - started)),
          timestamp,
          requestBody,
        });

        throw error;
      }
    }) as typeof fetch;
  }

  // --- XHR interception (SDK-02) ---

  private interceptXhr(): void {
    if (typeof XMLHttpRequest === "undefined") {
      return;
    }

    const self = this;
    const OriginalOpen = XMLHttpRequest.prototype.open;
    const OriginalSend = XMLHttpRequest.prototype.send;

    this.originalXhrOpen = OriginalOpen;
    this.originalXhrSend = OriginalSend;

    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      (this as unknown as Record<string, unknown>).__qb_method = method;
      (this as unknown as Record<string, unknown>).__qb_url = String(url);
      return (OriginalOpen as Function).apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const method = ((this as unknown as Record<string, unknown>).__qb_method as string) || "GET";
      const url = ((this as unknown as Record<string, unknown>).__qb_url as string) || "";
      const started = nowMs();
      const timestamp = new Date().toISOString();
      const shouldCaptureBody = !isAuthUrl(url);

      let requestBody: string | undefined;
      if (self.options.captureRequestBodies && shouldCaptureBody && hasBody(method) && body) {
        try {
          const raw = typeof body === "string" ? body : JSON.stringify(body);
          requestBody = truncate(
            redactJson(raw, self.options.redactBodyKeys),
            self.options.maxBodySize,
          );
        } catch {
          // skip
        }
      }

      this.addEventListener("loadend", function () {
        let responseBody: string | undefined;
        if (self.options.captureResponseBodies && shouldCaptureBody) {
          try {
            const text = typeof this.responseText === "string" ? this.responseText : "";
            if (text) {
              responseBody = truncate(
                redactJson(text, self.options.redactBodyKeys),
                self.options.maxBodySize,
              );
            }
          } catch {
            // skip
          }
        }

        const entry: NetworkLogEntry = {
          method,
          url,
          status: this.status || null,
          durationMs: Math.max(0, Math.round(nowMs() - started)),
          timestamp,
        };
        if (requestBody !== undefined) entry.requestBody = requestBody;
        if (responseBody !== undefined) entry.responseBody = responseBody;

        self.logs.push(entry);
      });

      return OriginalSend.call(this, body);
    };
  }

  private restoreXhr(): void {
    if (typeof XMLHttpRequest === "undefined") return;

    if (this.originalXhrOpen) {
      XMLHttpRequest.prototype.open = this.originalXhrOpen;
      this.originalXhrOpen = null;
    }
    if (this.originalXhrSend) {
      XMLHttpRequest.prototype.send = this.originalXhrSend;
      this.originalXhrSend = null;
    }
  }
}
