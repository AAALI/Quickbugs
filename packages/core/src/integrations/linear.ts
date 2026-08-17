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

type LinearGraphQLError = {
  message?: string;
};

type LinearIssue = {
  id: string;
  identifier: string;
  url: string | null;
};

type LinearFileUploadTarget = {
  uploadUrl: string;
  assetUrl: string;
  headers: Array<{ key: string; value: string }>;
};

export type LinearIntegrationOptions = {
  // Prefer proxy endpoints in production so API keys stay server-side.
  apiKey?: string;
  teamId?: string;
  projectId?: string;
  graphqlEndpoint?: string;
  // Stub: this endpoint can accept the full report payload and create a Linear issue server-side.
  submitProxyEndpoint?: string;
  // Stub: implement this endpoint in your backend proxy for issue creation.
  createIssueProxyEndpoint?: string;
  // Stub: implement this endpoint in your backend proxy for media uploads.
  uploadProxyEndpoint?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_GRAPHQL_ENDPOINT = "https://api.linear.app/graphql";
const noop: SubmitProgressCallback = () => {};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseErrorMessage(body: unknown, fallback: string): string {
  if (!isRecord(body)) {
    return fallback;
  }

  if (Array.isArray(body.errors)) {
    const messages = body.errors
      .map((entry) => {
        if (isRecord(entry) && typeof (entry as LinearGraphQLError).message === "string") {
          return (entry as LinearGraphQLError).message;
        }

        return "";
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join("; ");
    }
  }

  return fallback;
}

function ensureString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message);
  }

  return value;
}

function buildCleanDescription(
  payload: BugReportPayload,
  mediaLinks: {
    recordingUrl: string | null;
    screenshotUrl: string | null;
  },
): string {
  const lines: string[] = [
    payload.description,
    "",
    "### Context",
    `- Reported At: ${payload.stoppedAt}`,
    `- Capture Mode: ${payload.captureMode === "screenshot" ? "Screenshot" : "Video"}`,
    `- Page URL: ${payload.pageUrl ? redactUrl(payload.pageUrl, DEFAULT_PRIVACY) : "Unknown"}`,
    "",
  ];

  if (mediaLinks.screenshotUrl || mediaLinks.recordingUrl) {
    lines.push("### Media");

    if (mediaLinks.screenshotUrl) {
      lines.push(`- Screenshot: [Open screenshot](${mediaLinks.screenshotUrl})`);
    }

    if (mediaLinks.recordingUrl) {
      lines.push(`- Recording: [Open recording](${mediaLinks.recordingUrl})`);
    }

    lines.push("");
  }

  lines.push(
    "*Network logs and client metadata are attached as comments below.*",
  );

  return lines.join("\n");
}

export class LinearIntegration implements BugReporterIntegration {
  readonly provider = "linear" as const;

  private readonly apiKey?: string;
  private readonly teamId?: string;
  private readonly projectId?: string;
  private readonly graphqlEndpoint: string;
  private readonly submitProxyEndpoint?: string;
  private readonly createIssueProxyEndpoint?: string;
  private readonly uploadProxyEndpoint?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: LinearIntegrationOptions) {
    this.apiKey = options.apiKey;
    this.teamId = options.teamId;
    this.projectId = options.projectId;
    this.graphqlEndpoint = options.graphqlEndpoint ?? DEFAULT_GRAPHQL_ENDPOINT;
    this.submitProxyEndpoint = options.submitProxyEndpoint;
    this.createIssueProxyEndpoint = options.createIssueProxyEndpoint;
    this.uploadProxyEndpoint = options.uploadProxyEndpoint;
    this.fetchImpl =
      options.fetchImpl ??
      ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
  }

  async submit(payload: BugReportPayload, onProgress?: SubmitProgressCallback): Promise<BugSubmitResult> {
    if (this.submitProxyEndpoint) {
      return this.submitViaProxy(payload, onProgress);
    }

    const progress = onProgress ?? noop;

    progress("Uploading media…");
    const [screenshotUrl, recordingUrl] = await Promise.all([
      payload.screenshotBlob
        ? this.uploadAsset(payload.screenshotBlob, "bug-screenshot.png", "image/png")
        : Promise.resolve(null),
      payload.videoBlob
        ? this.uploadAsset(payload.videoBlob, "bug-recording.webm", "video/webm")
        : Promise.resolve(null),
    ]);

    progress("Creating Linear issue…");
    const description = buildCleanDescription(payload, { screenshotUrl, recordingUrl });
    const issue = await this.createIssue(payload.title, description);

    progress("Attaching logs…");
    const comments: Promise<void>[] = [];

    const logsComment = "### Network Logs\n```text\n" + formatNetworkLogs(payload.networkLogs) + "\n```";
    comments.push(this.addComment(issue.id, logsComment));

    if (payload.jsErrors.length > 0 || payload.consoleLogs.length > 0) {
      const parts: string[] = [];
      if (payload.jsErrors.length > 0) {
        parts.push("### JavaScript Errors\n```text\n" + formatJsErrors(payload.jsErrors) + "\n```");
      }
      if (payload.consoleLogs.length > 0) {
        parts.push("### Console Output\n```text\n" + formatConsoleLogs(payload.consoleLogs) + "\n```");
      }
      comments.push(this.addComment(issue.id, parts.join("\n\n")));
    }

    const metadataComment = "### Client Metadata\n```json\n" + JSON.stringify(payload.metadata, null, 2) + "\n```";
    comments.push(this.addComment(issue.id, metadataComment));

    await Promise.all(comments);

    progress("Done!");
    return {
      provider: this.provider,
      issueId: issue.id,
      issueKey: issue.identifier,
      issueUrl: issue.url,
      warnings: [],
    };
  }

  private async submitViaProxy(payload: BugReportPayload, onProgress?: SubmitProgressCallback): Promise<BugSubmitResult> {
    if (!this.submitProxyEndpoint) {
      throw new Error("Linear submit proxy endpoint is not configured.");
    }

    const formData = new FormData();
    formData.set("provider", "linear");
    formData.set("title", payload.title);
    formData.set("description", buildCleanDescription(payload, { screenshotUrl: null, recordingUrl: null }));

    if (this.teamId) {
      formData.set("teamId", this.teamId);
    }

    if (this.projectId) {
      formData.set("projectId", this.projectId);
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

    (onProgress ?? noop)("Submitting to Linear…");
    const response = await this.fetchImpl(this.submitProxyEndpoint, {
      method: "POST",
      body: formData,
    });

    const body = (await response.json().catch(() => null)) as
      | {
          error?: { message?: string } | string;
          linear?: { id?: string; identifier?: string; url?: string | null };
          warnings?: string[];
        }
      | null;

    if (!response.ok) {
      const errorMessage =
        typeof body?.error === "string"
          ? body.error
          : body?.error?.message || "Linear proxy submission failed.";
      throw new Error(errorMessage);
    }

    const linear = body?.linear;

    if (!linear?.id || !linear.identifier) {
      throw new Error("Linear proxy submission failed: invalid response.");
    }

    return {
      provider: this.provider,
      issueId: linear.id,
      issueKey: linear.identifier,
      issueUrl: linear.url ?? null,
      warnings: Array.isArray(body?.warnings) ? body.warnings : [],
    };
  }

  private async createIssue(title: string, description: string): Promise<LinearIssue> {
    if (this.createIssueProxyEndpoint) {
      const response = await this.fetchImpl(this.createIssueProxyEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          teamId: this.teamId,
          projectId: this.projectId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { id?: string; identifier?: string; url?: string | null; error?: string }
        | null;

      if (!response.ok || !payload?.id || !payload.identifier) {
        throw new Error(payload?.error || "Linear issue creation proxy failed.");
      }

      return {
        id: payload.id,
        identifier: payload.identifier,
        url: payload.url ?? null,
      };
    }

    if (!this.apiKey || !this.teamId) {
      throw new Error(
        "Linear integration is missing credentials. Configure apiKey + teamId or a createIssueProxyEndpoint.",
      );
    }

    const query = `
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            url
          }
        }
      }
    `;

    const issueInput: Record<string, unknown> = {
      teamId: this.teamId,
      title,
      description,
    };

    if (this.projectId) {
      issueInput.projectId = this.projectId;
    }

    const response = await this.fetchImpl(this.graphqlEndpoint, {
      method: "POST",
      headers: {
        Authorization: this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          input: issueInput,
        },
      }),
    });

    const body = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(parseErrorMessage(body, `Linear issue creation failed (${response.status})`));
    }

    const parsedIssueCreate =
      isRecord(body) && isRecord(body.data) && isRecord(body.data.issueCreate)
        ? body.data.issueCreate
        : null;

    const parsedIssue = parsedIssueCreate && isRecord(parsedIssueCreate.issue) ? parsedIssueCreate.issue : null;

    if (!parsedIssueCreate || !parsedIssue || parsedIssueCreate.success !== true) {
      throw new Error(parseErrorMessage(body, "Linear issue creation failed."));
    }

    return {
      id: ensureString(parsedIssue.id, "Linear did not return issue id."),
      identifier: ensureString(parsedIssue.identifier, "Linear did not return issue identifier."),
      url: typeof parsedIssue.url === "string" ? parsedIssue.url : null,
    };
  }

  private async addComment(issueId: string, body: string): Promise<void> {
    if (!this.apiKey) {
      // If using proxy-only mode, skip comment attachment silently.
      return;
    }

    const query = `
      mutation CommentCreate($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          success
        }
      }
    `;

    const response = await this.fetchImpl(this.graphqlEndpoint, {
      method: "POST",
      headers: {
        Authorization: this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          input: { issueId, body },
        },
      }),
    });

    if (!response.ok) {
      // Non-critical: don't throw, just swallow.  The issue was already created.
    }
  }

  private async uploadAsset(blob: Blob, fileName: string, fallbackMimeType: string): Promise<string> {
    const file = toBlobFile(blob, fileName, fallbackMimeType);

    if (this.uploadProxyEndpoint) {
      const formData = new FormData();
      formData.set("file", file, file.name);
      formData.set("filename", file.name);
      formData.set("contentType", file.type || fallbackMimeType);

      const response = await this.fetchImpl(this.uploadProxyEndpoint, {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as { assetUrl?: string; error?: string } | null;

      if (!response.ok || !payload?.assetUrl) {
        throw new Error(payload?.error || "Linear upload proxy failed.");
      }

      return payload.assetUrl;
    }

    if (!this.apiKey) {
      throw new Error("Linear upload requires apiKey or uploadProxyEndpoint.");
    }

    const uploadTarget = await this.requestUploadTarget(file);
    const uploadHeaders = uploadTarget.headers.reduce<Record<string, string>>((acc, entry) => {
      if (entry.key && entry.value) {
        acc[entry.key] = entry.value;
      }

      return acc;
    }, {});

    const uploadResponse = await this.fetchImpl(uploadTarget.uploadUrl, {
      method: "PUT",
      headers: uploadHeaders,
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(
        "Linear media upload failed. Configure an uploadProxyEndpoint if your browser blocks direct uploads.",
      );
    }

    return uploadTarget.assetUrl;
  }

  private async requestUploadTarget(file: File): Promise<LinearFileUploadTarget> {
    const query = `
      mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
        fileUpload(contentType: $contentType, filename: $filename, size: $size) {
          success
          uploadFile {
            uploadUrl
            assetUrl
            headers {
              key
              value
            }
          }
        }
      }
    `;

    const response = await this.fetchImpl(this.graphqlEndpoint, {
      method: "POST",
      headers: {
        Authorization: ensureString(this.apiKey, "Linear upload requires apiKey."),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          contentType: file.type || "application/octet-stream",
          filename: file.name,
          size: file.size,
        },
      }),
    });

    const body = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(parseErrorMessage(body, `Linear upload target request failed (${response.status})`));
    }

    const uploadFile =
      isRecord(body) &&
      isRecord(body.data) &&
      isRecord(body.data.fileUpload) &&
      isRecord(body.data.fileUpload.uploadFile)
        ? body.data.fileUpload.uploadFile
        : null;

    const headers = Array.isArray(uploadFile?.headers)
      ? uploadFile.headers
          .filter((entry): entry is { key: string; value: string } => {
            return isRecord(entry) && typeof entry.key === "string" && typeof entry.value === "string";
          })
      : [];

    if (!uploadFile || typeof uploadFile.uploadUrl !== "string" || typeof uploadFile.assetUrl !== "string") {
      throw new Error(parseErrorMessage(body, "Linear did not return a valid upload target."));
    }

    return {
      uploadUrl: uploadFile.uploadUrl,
      assetUrl: uploadFile.assetUrl,
      headers,
    };
  }
}
