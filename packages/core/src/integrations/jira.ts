import { redactUrl, resolvePrivacy } from "../privacy";
import {
  BugReportPayload,
  BugReporterIntegration,
  BugSubmitResult,
  SubmitProgressCallback,
  formatConsoleLogs,
  formatJsErrors,
  formatNetworkLogs,
  toBlobFile,
} from "../types";

/**
 * Built-in privacy defaults.
 *
 * These integrations post to the customer's own tracker, but a ticket is
 * visible to their whole org — a token in a captured URL would leak just as
 * surely there. Defaults apply unconditionally.
 */
const DEFAULT_PRIVACY = resolvePrivacy();

type JiraIssue = {
  id: string;
  key: string;
  url: string;
};

export type JiraIntegrationOptions = {
  // Prefer backend proxy endpoints in production so credentials stay server-side.
  baseUrl?: string;
  email?: string;
  apiToken?: string;
  projectKey?: string;
  issueType?: string;
  // Stub: this endpoint can accept the full report payload and create a Jira issue server-side.
  submitProxyEndpoint?: string;
  // Stub: implement this endpoint in your backend proxy for issue creation.
  createIssueProxyEndpoint?: string;
  // Stub: implement this endpoint in your backend proxy for file uploads.
  uploadAttachmentProxyEndpoint?: string;
  fetchImpl?: typeof fetch;
};

const noop: SubmitProgressCallback = () => {};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toBasicAuth(email: string, token: string): string {
  if (typeof btoa !== "function") {
    throw new Error("btoa is unavailable; use backend proxy endpoints for Jira auth.");
  }

  return `Basic ${btoa(`${email}:${token}`)}`;
}

function getErrorDetail(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) {
    return fallback;
  }

  if (Array.isArray(payload.errorMessages) && payload.errorMessages.length > 0) {
    return payload.errorMessages.map((entry) => String(entry)).join("; ");
  }

  if (isRecord(payload.errors)) {
    return Object.values(payload.errors)
      .map((entry) => String(entry))
      .join("; ");
  }

  return fallback;
}

function buildCleanDescription(payload: BugReportPayload): string {
  const lines: string[] = [
    payload.description,
    "",
    "Context:",
    `- Reported At: ${payload.stoppedAt}`,
    `- Capture Mode: ${payload.captureMode === "screenshot" ? "Screenshot" : "Video"}`,
    `- Page URL: ${payload.pageUrl ? redactUrl(payload.pageUrl, DEFAULT_PRIVACY) : "Unknown"}`,
  ];

  const hasScreenshot = Boolean(payload.screenshotBlob);
  const hasVideo = Boolean(payload.videoBlob);

  if (hasScreenshot || hasVideo) {
    lines.push("", "Attachments:");
    if (hasScreenshot) lines.push("- Screenshot attached");
    if (hasVideo) lines.push("- Screen recording attached");
    lines.push("- Network logs attached (network-logs.txt)");
    lines.push("- Client metadata attached (client-metadata.json)");
  }

  return lines.join("\n");
}

function toJiraAdf(text: string): Record<string, unknown> {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => ({
      type: "paragraph",
      content: [{ type: "text", text: chunk }],
    }));

  return {
    type: "doc",
    version: 1,
    content: paragraphs,
  };
}

export class JiraIntegration implements BugReporterIntegration {
  readonly provider = "jira" as const;

  private readonly baseUrl?: string;
  private readonly email?: string;
  private readonly apiToken?: string;
  private readonly projectKey?: string;
  private readonly issueType: string;
  private readonly submitProxyEndpoint?: string;
  private readonly createIssueProxyEndpoint?: string;
  private readonly uploadAttachmentProxyEndpoint?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: JiraIntegrationOptions) {
    this.baseUrl = options.baseUrl?.replace(/\/$/, "");
    this.email = options.email;
    this.apiToken = options.apiToken;
    this.projectKey = options.projectKey;
    this.issueType = options.issueType ?? "Bug";
    this.submitProxyEndpoint = options.submitProxyEndpoint;
    this.createIssueProxyEndpoint = options.createIssueProxyEndpoint;
    this.uploadAttachmentProxyEndpoint = options.uploadAttachmentProxyEndpoint;
    this.fetchImpl =
      options.fetchImpl ??
      ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
  }

  async submit(payload: BugReportPayload, onProgress?: SubmitProgressCallback): Promise<BugSubmitResult> {
    if (this.submitProxyEndpoint) {
      return this.submitViaProxy(payload, onProgress);
    }

    const progress = onProgress ?? noop;

    progress("Creating Jira issue…");
    const issue = await this.createIssue(payload);

    progress("Uploading attachments…");
    const uploads: Promise<void>[] = [];

    if (payload.screenshotBlob) {
      uploads.push(this.uploadAttachment(issue.key, payload.screenshotBlob, "bug-screenshot.png", "image/png"));
    }

    if (payload.videoBlob) {
      uploads.push(this.uploadAttachment(issue.key, payload.videoBlob, "bug-recording.webm", "video/webm"));
    }

    const logsBlob = new Blob([formatNetworkLogs(payload.networkLogs)], { type: "text/plain" });
    uploads.push(this.uploadAttachment(issue.key, logsBlob, "network-logs.txt", "text/plain"));

    if (payload.consoleLogs.length > 0 || payload.jsErrors.length > 0) {
      const consoleParts: string[] = [];
      if (payload.jsErrors.length > 0) {
        consoleParts.push("=== JavaScript Errors ===\n" + formatJsErrors(payload.jsErrors));
      }
      if (payload.consoleLogs.length > 0) {
        consoleParts.push("=== Console Output ===\n" + formatConsoleLogs(payload.consoleLogs));
      }
      const consoleBlob = new Blob([consoleParts.join("\n\n")], { type: "text/plain" });
      uploads.push(this.uploadAttachment(issue.key, consoleBlob, "console-logs.txt", "text/plain"));
    }

    const metadataBlob = new Blob([JSON.stringify(payload.metadata, null, 2)], { type: "application/json" });
    uploads.push(this.uploadAttachment(issue.key, metadataBlob, "client-metadata.json", "application/json"));

    await Promise.all(uploads);

    progress("Done!");
    return {
      provider: this.provider,
      issueId: issue.id,
      issueKey: issue.key,
      issueUrl: issue.url,
      warnings: [],
    };
  }

  private async submitViaProxy(payload: BugReportPayload, onProgress?: SubmitProgressCallback): Promise<BugSubmitResult> {
    if (!this.submitProxyEndpoint) {
      throw new Error("Jira submit proxy endpoint is not configured.");
    }

    const formData = new FormData();
    formData.set("provider", "jira");
    formData.set("title", payload.title);
    formData.set("description", buildCleanDescription(payload));
    formData.set("issueType", this.issueType);

    if (this.projectKey) {
      formData.set("projectKey", this.projectKey);
    }

    if (payload.screenshotBlob) {
      formData.append("screenshotFile", toBlobFile(payload.screenshotBlob, "bug-screenshot.png", "image/png"), "bug-screenshot.png");
    }

    if (payload.videoBlob) {
      formData.append("screenRecordingFile", toBlobFile(payload.videoBlob, "bug-recording.webm", "video/webm"), "bug-recording.webm");
    }

    formData.append("networkLogsFile", new Blob([formatNetworkLogs(payload.networkLogs)], { type: "text/plain" }), "network-logs.txt");
    formData.append("clientMetadataFile", new Blob([JSON.stringify(payload.metadata, null, 2)], { type: "application/json" }), "client-metadata.json");

    if (payload.consoleLogs.length > 0 || payload.jsErrors.length > 0) {
      const consoleParts: string[] = [];
      if (payload.jsErrors.length > 0) {
        consoleParts.push("=== JavaScript Errors ===\n" + formatJsErrors(payload.jsErrors));
      }
      if (payload.consoleLogs.length > 0) {
        consoleParts.push("=== Console Output ===\n" + formatConsoleLogs(payload.consoleLogs));
      }
      formData.append("consoleLogsFile", new Blob([consoleParts.join("\n\n")], { type: "text/plain" }), "console-logs.txt");
    }

    (onProgress ?? noop)("Submitting to Jira…");
    const response = await this.fetchImpl(this.submitProxyEndpoint, {
      method: "POST",
      body: formData,
    });

    const body = (await response.json().catch(() => null)) as
      | {
          error?: { message?: string } | string;
          jira?: { id?: string; key?: string; url?: string | null };
          warnings?: string[];
        }
      | null;

    if (!response.ok) {
      const errorMessage =
        typeof body?.error === "string"
          ? body.error
          : body?.error?.message || "Jira proxy submission failed.";
      throw new Error(errorMessage);
    }

    const jira = body?.jira;

    if (!jira?.id || !jira.key) {
      throw new Error("Jira proxy submission failed: invalid response.");
    }

    return {
      provider: this.provider,
      issueId: jira.id,
      issueKey: jira.key,
      issueUrl: jira.url ?? null,
      warnings: Array.isArray(body?.warnings) ? body.warnings : [],
    };
  }

  private async createIssue(payload: BugReportPayload): Promise<JiraIssue> {
    if (this.createIssueProxyEndpoint) {
      const response = await this.fetchImpl(this.createIssueProxyEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: payload.title,
          description: buildCleanDescription(payload),
          issueType: this.issueType,
          projectKey: this.projectKey,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { id?: string; key?: string; url?: string; error?: string }
        | null;

      if (!response.ok || !data?.id || !data.key || !data.url) {
        throw new Error(data?.error || "Jira issue creation proxy failed.");
      }

      return {
        id: data.id,
        key: data.key,
        url: data.url,
      };
    }

    if (!this.baseUrl || !this.email || !this.apiToken || !this.projectKey) {
      throw new Error(
        "Jira integration is missing credentials. Configure baseUrl + email + apiToken + projectKey or a createIssueProxyEndpoint.",
      );
    }

    const response = await this.fetchImpl(`${this.baseUrl}/rest/api/3/issue`, {
      method: "POST",
      credentials: "omit",
      headers: {
        Authorization: toBasicAuth(this.email, this.apiToken),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        fields: {
          project: { key: this.projectKey },
          summary: payload.title,
          description: toJiraAdf(buildCleanDescription(payload)),
          issuetype: { name: this.issueType },
        },
      }),
    });

    const data = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(getErrorDetail(data, `Jira issue creation failed (${response.status}).`));
    }

    if (!isRecord(data) || typeof data.id !== "string" || typeof data.key !== "string") {
      throw new Error("Jira issue creation failed: invalid API response.");
    }

    return {
      id: data.id,
      key: data.key,
      url: `${this.baseUrl}/browse/${data.key}`,
    };
  }

  private async uploadAttachment(
    issueKey: string,
    blob: Blob,
    fileName: string,
    fallbackMimeType: string,
  ): Promise<void> {
    const file = toBlobFile(blob, fileName, fallbackMimeType);

    if (this.uploadAttachmentProxyEndpoint) {
      const formData = new FormData();
      formData.set("issueKey", issueKey);
      formData.set("file", file, file.name);

      const response = await this.fetchImpl(this.uploadAttachmentProxyEndpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Jira attachment upload proxy failed.");
      }

      return;
    }

    if (!this.baseUrl || !this.email || !this.apiToken) {
      throw new Error("Jira attachment upload requires credentials or uploadAttachmentProxyEndpoint.");
    }

    const formData = new FormData();
    formData.set("file", file, file.name);

    const response = await this.fetchImpl(`${this.baseUrl}/rest/api/3/issue/${issueKey}/attachments`, {
      method: "POST",
      credentials: "omit",
      headers: {
        Authorization: toBasicAuth(this.email, this.apiToken),
        Accept: "application/json",
        "X-Atlassian-Token": "no-check",
      },
      body: formData,
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as unknown;
      throw new Error(getErrorDetail(data, `Jira attachment upload failed (${response.status}).`));
    }
  }
}
