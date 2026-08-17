import {
  type PrivacyOptions,
  type ResolvedPrivacy,
  redactJson,
  redactUrl,
  resolvePrivacy,
  truncate,
} from "./privacy";
import { NetworkLogEntry } from "./types";

export type NetworkLoggerOptions = {
  captureRequestBodies?: boolean;
  captureResponseBodies?: boolean;
  maxBodySize?: number;
  /**
   * Body keys to redact, added to the built-in defaults.
   *
   * @deprecated Prefer `privacy.redactLogKeys`, which applies to URLs and
   * screenshots too. Both are honoured.
   */
  redactBodyKeys?: string[];
  /** Privacy configuration merged over the built-in defaults. */
  privacy?: PrivacyOptions;
};

const DEFAULT_MAX_BODY_SIZE = 10_000;

/**
 * Request paths whose bodies are never captured, regardless of configuration.
 *
 * Redaction relies on recognising key names; these endpoints exchange
 * credentials in shapes we cannot reliably introspect, so we skip the body
 * entirely rather than hope a key name matches.
 */
const AUTH_PATH_PATTERNS = ["/auth/", "/login", "/signin", "/session", "/token", "/oauth"];

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
  private readonly options: {
    captureRequestBodies: boolean;
    captureResponseBodies: boolean;
    maxBodySize: number;
  };
  private readonly privacy: ResolvedPrivacy;

  constructor(options: NetworkLoggerOptions = {}) {
    this.options = {
      captureRequestBodies: options.captureRequestBodies ?? false,
      captureResponseBodies: options.captureResponseBodies ?? false,
      maxBodySize: options.maxBodySize ?? DEFAULT_MAX_BODY_SIZE,
    };

    // `redactBodyKeys` predates the unified privacy config; fold it in so both
    // spellings work and neither can narrow the defaults.
    this.privacy = resolvePrivacy({
      ...options.privacy,
      redactLogKeys: [...(options.privacy?.redactLogKeys ?? []), ...(options.redactBodyKeys ?? [])],
    });
  }

  /** Strip credential-bearing parameters before a URL is ever stored. */
  private safeUrl(url: string): string {
    return redactUrl(url, this.privacy);
  }

  /** Redact and truncate a captured body to the configured limit. */
  private safeBody(raw: string): string {
    return truncate(redactJson(raw, this.privacy.redactLogKeys), this.options.maxBodySize);
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
      const rawUrl = resolveUrl(input);
      const url = self.safeUrl(rawUrl);
      const timestamp = new Date().toISOString();
      const shouldCaptureBody = !isAuthUrl(rawUrl);

      let requestBody: string | undefined;
      if (self.options.captureRequestBodies && shouldCaptureBody && hasBody(method) && init?.body) {
        try {
          const raw = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
          requestBody = self.safeBody(raw);
        } catch {
          // A body we cannot serialize is a body we cannot redact — skip it.
        }
      }

      try {
        const response = await originalFetch.call(globalThis, input, init);

        let responseBody: string | undefined;
        if (self.options.captureResponseBodies && shouldCaptureBody) {
          try {
            const clone = response.clone();
            const text = await clone.text();
            responseBody = self.safeBody(text);
          } catch {
            // Body already consumed or unreadable — omit rather than guess.
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
      const rawUrl = ((this as unknown as Record<string, unknown>).__qb_url as string) || "";
      const url = self.safeUrl(rawUrl);
      const started = nowMs();
      const timestamp = new Date().toISOString();
      const shouldCaptureBody = !isAuthUrl(rawUrl);

      let requestBody: string | undefined;
      if (self.options.captureRequestBodies && shouldCaptureBody && hasBody(method) && body) {
        try {
          const raw = typeof body === "string" ? body : JSON.stringify(body);
          requestBody = self.safeBody(raw);
        } catch {
          // A body we cannot serialize is a body we cannot redact — skip it.
        }
      }

      this.addEventListener("loadend", function () {
        let responseBody: string | undefined;
        if (self.options.captureResponseBodies && shouldCaptureBody) {
          try {
            const text = typeof this.responseText === "string" ? this.responseText : "";
            if (text) {
              responseBody = self.safeBody(text);
            }
          } catch {
            // responseText throws for non-text responseTypes — omit the body.
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
