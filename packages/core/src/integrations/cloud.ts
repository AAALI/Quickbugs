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
  ingestUrl?: string;
  endpoint?: string;
  appVersion?: string;
  environment?: string;
  fetchImpl?: typeof fetch;
};

const noop: SubmitProgressCallback = () => {};

export class CloudIntegration implements BugReporterIntegration {
  readonly provider = "cloud" as const;

  private projectKey: string;
  private endpoint: string;
  private appVersion?: string;
  private environment?: string;
  private fetchFn: typeof fetch;

  constructor(options: CloudIntegrationOptions) {
    if (!options.projectKey) {
      throw new Error("CloudIntegration: projectKey is required.");
    }

    this.projectKey = options.projectKey;
    this.endpoint = options.ingestUrl ?? options.endpoint ?? "/api/ingest";
    this.appVersion = options.appVersion;
    this.environment = options.environment;
    this.fetchFn = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async submit(
    payload: BugReportPayload,
    onProgress: SubmitProgressCallback = noop,
  ): Promise<BugSubmitResult> {
    onProgress("Preparing report…");

    // Parse user agent for metadata
    const ua = payload.userAgent || getRuntimeUserAgent();
    const browserName = parseBrowserName(ua);
    const browserVersion = parseBrowserVersion(ua);
    const osName = parseOsName(ua);
    const osVersion = parseOsVersion(ua, osName);

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
    fd.set("browser_version", browserVersion ?? "");
    fd.set("os_name", osName);
    fd.set("os_version", osVersion ?? "");
    fd.set("device_type", getDeviceType());
    fd.set("screen_resolution", getScreenResolution());
    fd.set("viewport", getViewport());
    fd.set("color_scheme", payload.metadata.colorScheme !== "unknown" ? payload.metadata.colorScheme : "");
    fd.set("locale", payload.metadata.locale ?? "");
    fd.set("timezone", payload.metadata.timezone ?? "");
    fd.set("connection_type", payload.metadata.connection?.effectiveType ?? "");
    fd.set("page_url", payload.pageUrl || "");
    fd.set("environment", this.environment ?? getEnvironment());
    fd.set("app_version", this.appVersion ?? "");
    fd.set("platform", payload.metadata.platform ?? "");
    fd.set("duration_ms", String(payload.elapsedMs));
    fd.set("stopped_at", payload.stoppedAt || "");

    if (payload.metadata.mobile) {
      fd.set("platform", payload.metadata.mobile.platform);
      fd.set("device_model", payload.metadata.mobile.deviceModel ?? "");
      fd.set("device_brand", payload.metadata.mobile.deviceBrand ?? "");
      fd.set("os_version", payload.metadata.mobile.osVersion ?? "");
      fd.set("app_build_number", payload.metadata.mobile.appBuildNumber ?? "");
      fd.set("is_emulator", String(payload.metadata.mobile.isEmulator));
      fd.set(
        "battery_level",
        payload.metadata.mobile.batteryLevel == null ? "" : String(payload.metadata.mobile.batteryLevel),
      );
      fd.set(
        "free_storage_mb",
        payload.metadata.mobile.freeStorageMb == null ? "" : String(payload.metadata.mobile.freeStorageMb),
      );
      fd.set("invocation_method", payload.metadata.mobile.invocationMethod);
    }

    // Attach screenshot / video blobs
    if (payload.screenshotBlob) {
      fd.append("screenshot", payload.screenshotBlob, "bug-screenshot.png");
    }
    if (payload.videoBlob) {
      fd.append("video", payload.videoBlob, "bug-recording.webm");
    }

    // Always attach network logs (placeholder text when empty)
    fd.append(
      "network_logs",
      new Blob([formatNetworkLogs(payload.networkLogs)], { type: "text/plain" }),
      "network-logs.txt",
    );

    // Always attach console logs (placeholder text when empty)
    const parts: string[] = [];
    if (payload.jsErrors.length > 0) {
      parts.push("=== JavaScript Errors ===\n" + formatJsErrors(payload.jsErrors));
    } else {
      parts.push("=== JavaScript Errors ===\nNo JavaScript errors captured.");
    }
    if (payload.consoleLogs.length > 0) {
      parts.push("=== Console Output ===\n" + formatConsoleLogs(payload.consoleLogs));
    } else {
      parts.push("=== Console Output ===\nNo console output captured.");
    }
    fd.append(
      "console_logs",
      new Blob([parts.join("\n\n")], { type: "text/plain" }),
      "console-logs.txt",
    );

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
      forwarding_status?: "queued" | "completed";
      forwarding?: { provider?: string; key?: string; url?: string; error?: string } | null;
    };

    onProgress("Report submitted.");

    // Use the real external issue key/URL from tracker forwarding when available
    const fwd = result.forwarding;
    const externalKey = fwd?.key;
    const externalUrl = fwd?.url;
    const warnings: string[] = [];

    if (result.forwarding_status === "queued") {
      warnings.push("Tracker forwarding is running in the background.");
    }

    if (fwd?.error) {
      warnings.push(`Forwarding: ${fwd.error}`);
    }

    return {
      provider: "cloud" as BugSubmitResult["provider"],
      issueId: result.id,
      issueKey: externalKey || `QB-${result.id.slice(0, 8)}`,
      issueUrl: externalUrl || null,
      warnings,
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

function parseBrowserVersion(ua: string): string | null {
  return (
    matchVersion(ua, /Edg\/([\d.]+)/) ||
    matchVersion(ua, /OPR\/([\d.]+)/) ||
    matchVersion(ua, /Opera\/([\d.]+)/) ||
    matchVersion(ua, /Chrome\/([\d.]+)/) ||
    matchVersion(ua, /Firefox\/([\d.]+)/) ||
    matchVersion(ua, /Version\/([\d.]+).*Safari/)
  );
}

function getRuntimeUserAgent(): string {
  if (typeof navigator !== "undefined" && typeof navigator.userAgent === "string") {
    return navigator.userAgent;
  }
  return "";
}

function parseOsName(ua: string): string {
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Mac OS")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  return "Unknown";
}

function parseOsVersion(ua: string, osName: string): string | null {
  if (osName === "Windows") {
    const nt = matchVersion(ua, /Windows NT ([\d.]+)/);
    if (!nt) return null;

    if (nt.startsWith("10.0")) return "10/11";
    if (nt.startsWith("6.3")) return "8.1";
    if (nt.startsWith("6.2")) return "8";
    if (nt.startsWith("6.1")) return "7";
    return nt;
  }

  if (osName === "macOS") {
    const mac = matchVersion(ua, /Mac OS X ([0-9_]+)/);
    return mac ? mac.replace(/_/g, ".") : null;
  }

  if (osName === "Android") {
    return matchVersion(ua, /Android ([\d.]+)/);
  }

  if (osName === "iOS") {
    const ios = matchVersion(ua, /OS ([0-9_]+) like Mac OS X/);
    return ios ? ios.replace(/_/g, ".") : null;
  }

  return null;
}

function matchVersion(ua: string, pattern: RegExp): string | null {
  const match = ua.match(pattern);
  return match?.[1] ?? null;
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
