import {
  BugReportPayload,
  BugReporterIntegration,
  BugSubmitResult,
  SubmitProgressCallback,
  formatConsoleLogs,
  formatJsErrors,
  formatNetworkLogs,
} from "../types";

export type CloudIntegrationOptions = {
  projectKey: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

const noop: SubmitProgressCallback = () => {};

export class CloudIntegration implements BugReporterIntegration {
  readonly provider = "cloud" as const;

  private projectKey: string;
  private endpoint: string;
  private fetchFn: typeof fetch;

  constructor(options: CloudIntegrationOptions) {
    if (!options.projectKey) {
      throw new Error("CloudIntegration: projectKey is required.");
    }

    this.projectKey = options.projectKey;
    this.endpoint = options.endpoint ?? "/api/ingest";
    this.fetchFn = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async submit(
    payload: BugReportPayload,
    onProgress: SubmitProgressCallback = noop,
  ): Promise<BugSubmitResult> {
    onProgress("Preparing report…");

    // Parse user agent for metadata
    const ua = payload.userAgent || navigator.userAgent;
    const browserName = parseBrowserName(ua);
    const osName = parseOsName(ua);

    // Build FormData so we can include binary attachments
    const fd = new FormData();
    fd.set("project_key", this.projectKey);
    fd.set("title", payload.title);
    fd.set("description", payload.description || "");
    fd.set("provider", "cloud");
    fd.set("capture_mode", payload.captureMode);
    fd.set("has_screenshot", String(Boolean(payload.screenshotBlob)));
    fd.set("has_video", String(Boolean(payload.videoBlob)));
    fd.set("has_network_logs", String(payload.networkLogs.length > 0));
    fd.set("has_console_logs", String(payload.consoleLogs.length > 0));
    fd.set("js_error_count", String(payload.jsErrors.length));
    fd.set("user_agent", ua);
    fd.set("browser_name", browserName);
    fd.set("os_name", osName);
    fd.set("device_type", getDeviceType());
    fd.set("screen_resolution", getScreenResolution());
    fd.set("viewport", getViewport());
    fd.set("color_scheme", payload.metadata.colorScheme !== "unknown" ? payload.metadata.colorScheme : "");
    fd.set("locale", payload.metadata.locale ?? "");
    fd.set("timezone", payload.metadata.timezone ?? "");
    fd.set("connection_type", payload.metadata.connection?.effectiveType ?? "");
    fd.set("page_url", payload.pageUrl || "");
    fd.set("environment", getEnvironment());
    fd.set("stopped_at", payload.stoppedAt || "");

    // Attach screenshot / video blobs
    if (payload.screenshotBlob) {
      fd.append("screenshot", payload.screenshotBlob, "bug-screenshot.png");
    }
    if (payload.videoBlob) {
      fd.append("video", payload.videoBlob, "bug-recording.webm");
    }

    // Attach network logs
    if (payload.networkLogs.length > 0) {
      fd.append(
        "network_logs",
        new Blob([formatNetworkLogs(payload.networkLogs)], { type: "text/plain" }),
        "network-logs.txt",
      );
    }

    // Attach console logs + JS errors
    if (payload.consoleLogs.length > 0 || payload.jsErrors.length > 0) {
      const parts: string[] = [];
      if (payload.jsErrors.length > 0) {
        parts.push("=== JavaScript Errors ===\n" + formatJsErrors(payload.jsErrors));
      }
      if (payload.consoleLogs.length > 0) {
        parts.push("=== Console Output ===\n" + formatConsoleLogs(payload.consoleLogs));
      }
      fd.append(
        "console_logs",
        new Blob([parts.join("\n\n")], { type: "text/plain" }),
        "console-logs.txt",
      );
    }

    // Attach client metadata
    fd.append(
      "metadata",
      new Blob([JSON.stringify(payload.metadata, null, 2)], { type: "application/json" }),
      "client-metadata.json",
    );

    onProgress("Sending report…");

    const response = await this.fetchFn(this.endpoint, {
      method: "POST",
      body: fd,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = (errorBody as { error?: string }).error ?? `HTTP ${response.status}`;
      throw new Error(`CloudIntegration: ${message}`);
    }

    const result = (await response.json()) as {
      id: string;
      created_at: string;
      forwarding?: { provider?: string; key?: string; url?: string; error?: string } | null;
    };

    onProgress("Report submitted.");

    // Use the real external issue key/URL from tracker forwarding when available
    const fwd = result.forwarding;
    const externalKey = fwd?.key;
    const externalUrl = fwd?.url;

    return {
      provider: "cloud" as BugSubmitResult["provider"],
      issueId: result.id,
      issueKey: externalKey || `QB-${result.id.slice(0, 8)}`,
      issueUrl: externalUrl || null,
      warnings: fwd?.error ? [`Forwarding: ${fwd.error}`] : [],
    };
  }
}

// Simple UA parsing helpers
function parseBrowserName(ua: string): string {
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera/")) return "Opera";
  if (ua.includes("Chrome/") && !ua.includes("Edg/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  return "Unknown";
}

function parseOsName(ua: string): string {
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "Unknown";
}

function getDeviceType(): string {
  if (typeof window === "undefined") return "unknown";
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function getScreenResolution(): string {
  if (typeof screen === "undefined") return "";
  return `${screen.width}x${screen.height}`;
}

function getViewport(): string {
  if (typeof window === "undefined") return "";
  return `${window.innerWidth}x${window.innerHeight}`;
}

function getEnvironment(): string {
  if (typeof window === "undefined") return "unknown";
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return "development";
  if (hostname.includes("staging") || hostname.includes("preview")) return "staging";
  return "production";
}
