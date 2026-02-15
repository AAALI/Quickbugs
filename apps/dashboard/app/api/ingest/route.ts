import { after, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client bypasses RLS for ingestion
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─── Types ───────────────────────────────────────────────────────────

type BufferFile = { buffer: Buffer; name: string; type: string } | null;

type Attachments = {
  screenshot: BufferFile;
  video: BufferFile;
  networkLogs: BufferFile;
  consoleLogs: BufferFile;
  metadata: BufferFile;
};

// ─── Helpers ─────────────────────────────────────────────────────────

async function blobToBuffer(
  blob: Blob,
  fallbackName: string,
  fallbackType: string
): Promise<NonNullable<BufferFile>> {
  const buf = Buffer.from(await blob.arrayBuffer());
  const blobWithName = blob as Blob & { name?: unknown };
  const name = typeof blobWithName.name === "string" && blobWithName.name.length > 0
    ? blobWithName.name
    : fallbackName;
  const type = blob.type || fallbackType;
  return { buffer: buf, name, type };
}

async function uploadToStorage(
  basePath: string,
  attachments: Attachments
): Promise<Record<string, string>> {
  const paths: Record<string, string> = {};

  const items: Array<{ dbCol: string; file: NonNullable<BufferFile> }> = [];
  if (attachments.screenshot) items.push({ dbCol: "screenshot_path", file: attachments.screenshot });
  if (attachments.video) items.push({ dbCol: "video_path", file: attachments.video });
  if (attachments.networkLogs) items.push({ dbCol: "network_logs_path", file: attachments.networkLogs });
  if (attachments.consoleLogs) items.push({ dbCol: "console_logs_path", file: attachments.consoleLogs });
  if (attachments.metadata) items.push({ dbCol: "metadata_path", file: attachments.metadata });

  await Promise.all(
    items.map(async ({ dbCol, file }) => {
      const storagePath = `${basePath}/${file.name}`;
      const { error } = await supabase.storage
        .from("report-attachments")
        .upload(storagePath, file.buffer, {
          contentType: file.type,
          upsert: false,
        });
      if (error) {
        console.error(`[ingest] Storage upload failed (${file.name}):`, error.message);
      } else {
        paths[dbCol] = storagePath;
        console.log(`[ingest] Stored: ${storagePath}`);
      }
    }),
  );

  return paths;
}

// ─── POST handler ────────────────────────────────────────────────────
//
// Store-first architecture:
//   1. Parse FormData (iterate ALL entries, log everything)
//   2. Validate project key
//   3. Read file blobs into Buffers
//   4. INSERT report_events row (with title + description + metadata)
//   5. Upload attachments to Supabase Storage
//   6. UPDATE report_events with storage paths
//   7. Forward to connected trackers (Jira / Linear)
//   8. Return response
//
// This ensures nothing is lost even if tracker forwarding fails.
// ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("multipart/form-data")) {
      // Legacy JSON path — no attachments, just metadata
      const body = await request.json();
      const projectKey = body.project_key as string;
      if (!projectKey) {
        return NextResponse.json({ error: "Missing project_key." }, { status: 400, headers: corsHeaders });
      }
      // Minimal handling for legacy clients
      return NextResponse.json({ error: "Legacy JSON path no longer supported. Use FormData." }, { status: 400, headers: corsHeaders });
    }

    // ─── 1. Parse FormData — iterate ALL entries ───────────────
    const fd = await request.formData();

    const text: Record<string, string> = {};
    const blobs: Record<string, Blob> = {};

    for (const [key, value] of fd.entries()) {
      if (typeof value === "string") {
        text[key] = value;
      } else if (value instanceof Blob) {
        blobs[key] = value;
      }
    }

    // ── Heavy-duty logging so we can see EXACTLY what arrives ──
    console.log("[ingest] ════════════════════════════════════════");
    console.log("[ingest] Text fields received:", JSON.stringify(text));
    console.log("[ingest] File fields received:", JSON.stringify(
      Object.fromEntries(
        Object.entries(blobs).map(([k, v]) => [k, `${v.size} bytes, type=${v.type}`])
      )
    ));

    // Extract text fields from iterated map (NOT fd.get — avoids any proxy/parsing quirks)
    const projectKey = text["project_key"] ?? "";
    const title = text["title"] || "Untitled report";
    const description = text["description"] ?? "";
    const provider = text["provider"] || "cloud";
    const captureMode = text["capture_mode"] || "screenshot";
    const stoppedAt = text["stopped_at"] || null;
    const userAgent = text["user_agent"] || "";
    const browserName = text["browser_name"] || "";
    const browserVersion = text["browser_version"] || null;
    const osName = text["os_name"] || "";
    const deviceType = text["device_type"] || "";
    const screenResolution = text["screen_resolution"] || "";
    const viewport = text["viewport"] || "";
    const colorScheme = text["color_scheme"] || null;
    const locale = text["locale"] || null;
    const timezone = text["timezone"] || null;
    const connectionType = text["connection_type"] || null;
    const pageUrl = text["page_url"] || null;
    const environment = text["environment"] || null;
    const appVersion = text["app_version"] || null;
    const platform = text["platform"] || null;
    const deviceModel = text["device_model"] || null;
    const deviceBrand = text["device_brand"] || null;
    const osVersion = text["os_version"] || null;
    const appBuildNumber = text["app_build_number"] || null;
    const invocationMethod = text["invocation_method"] || null;
    const isEmulator =
      text["is_emulator"] === "true" ? true : text["is_emulator"] === "false" ? false : null;
    const batteryLevel =
      text["battery_level"] == null || text["battery_level"] === ""
        ? null
        : Number(text["battery_level"]);
    const freeStorageMb =
      text["free_storage_mb"] == null || text["free_storage_mb"] === ""
        ? null
        : parseInt(text["free_storage_mb"], 10);
    const durationMs =
      text["duration_ms"] == null || text["duration_ms"] === ""
        ? null
        : parseInt(text["duration_ms"], 10);
    const syncForwarding = text["sync_forwarding"] === "true";
    const jsErrorCount = parseInt(text["js_error_count"] || "0", 10) || 0;

    console.log("[ingest] title:", JSON.stringify(title));
    console.log("[ingest] description:", JSON.stringify(description), `(${description.length} chars)`);
    console.log("[ingest] projectKey:", projectKey);

    // ─── 2. Validate project key ──────────────────────────────
    if (!projectKey) {
      return NextResponse.json({ error: "Missing project_key." }, { status: 400, headers: corsHeaders });
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, is_active, rate_limit_per_min")
      .eq("project_key", projectKey)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Invalid project key." }, { status: 401, headers: corsHeaders });
    }

    if (!project.is_active) {
      return NextResponse.json({ error: "Project is inactive." }, { status: 403, headers: corsHeaders });
    }

    // Basic rate limit check
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabase
      .from("report_events")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .gte("created_at", oneMinuteAgo);

    if ((count ?? 0) >= project.rate_limit_per_min) {
      return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429, headers: corsHeaders });
    }

    // ─── 3. Read file blobs into Buffers ──────────────────────
    const screenshot = blobs["screenshot"]
      ? await blobToBuffer(blobs["screenshot"], "bug-screenshot.png", "image/png")
      : null;
    const video = blobs["video"]
      ? await blobToBuffer(blobs["video"], "bug-recording.webm", "video/webm")
      : null;
    const networkLogs = blobs["network_logs"]
      ? await blobToBuffer(blobs["network_logs"], "network-logs.txt", "text/plain")
      : null;
    const consoleLogs = blobs["console_logs"]
      ? await blobToBuffer(blobs["console_logs"], "console-logs.txt", "text/plain")
      : null;
    const metadata = blobs["metadata"]
      ? await blobToBuffer(blobs["metadata"], "client-metadata.json", "application/json")
      : null;

    const attachments: Attachments = { screenshot, video, networkLogs, consoleLogs, metadata };

    console.log("[ingest] Buffers — screenshot:", !!screenshot, "video:", !!video,
      "networkLogs:", !!networkLogs, "consoleLogs:", !!consoleLogs, "metadata:", !!metadata);

    // ─── 4. Store report in DB FIRST ──────────────────────────
    const { data: event, error: insertError } = await supabase
      .from("report_events")
      .insert({
        project_id: project.id,
        title,
        description: description || null,
        provider,
        capture_mode: captureMode,
        has_screenshot: !!screenshot,
        has_video: !!video,
        has_network_logs: !!networkLogs,
        has_console_logs: !!consoleLogs,
        js_error_count: jsErrorCount,
        user_agent: userAgent || null,
        browser_name: browserName || null,
        browser_version: browserVersion,
        os_name: osName || null,
        device_type: deviceType || null,
        screen_resolution: screenResolution || null,
        viewport: viewport || null,
        color_scheme: colorScheme,
        locale,
        timezone,
        connection_type: connectionType,
        page_url: pageUrl,
        app_version: appVersion,
        environment,
        platform,
        device_model: deviceModel,
        device_brand: deviceBrand,
        os_version: osVersion,
        is_emulator: isEmulator,
        battery_level: Number.isFinite(batteryLevel) ? batteryLevel : null,
        free_storage_mb: Number.isFinite(freeStorageMb) ? freeStorageMb : null,
        app_build_number: appBuildNumber,
        invocation_method: invocationMethod,
        duration_ms: Number.isFinite(durationMs) ? durationMs : null,
        status: "success",
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      console.error("[ingest] DB insert failed:", insertError.message);
      return NextResponse.json({ error: "Failed to store report." }, { status: 500, headers: corsHeaders });
    }

    console.log("[ingest] Report stored — id:", event.id, "description in DB:", description ? "YES" : "EMPTY");

    // ─── 5. Upload attachments to Supabase Storage ────────────
    const basePath = `${project.id}/${event.id}`;
    const storagePaths = await uploadToStorage(basePath, attachments);

    // ─── 6. Update report with storage paths ──────────────────
    if (Object.keys(storagePaths).length > 0) {
      const { error: updateError } = await supabase
        .from("report_events")
        .update(storagePaths)
        .eq("id", event.id);
      if (updateError) {
        console.error("[ingest] Storage path update failed:", updateError.message);
      }
    }

    // ─── 7. Forward to connected trackers ─────────────────────
    // Build reportData from explicit variables (not from a generic map)
    const reportData: Record<string, unknown> = {
      title,
      description,
      provider,
      capture_mode: captureMode,
      stopped_at: stoppedAt,
      page_url: pageUrl,
      user_agent: userAgent,
      browser_name: browserName,
      browser_version: browserVersion,
      os_name: osName,
      device_type: deviceType,
      screen_resolution: screenResolution,
      viewport,
      color_scheme: colorScheme,
      locale,
      timezone,
      connection_type: connectionType,
      app_version: appVersion,
      environment,
      platform,
      device_model: deviceModel,
      device_brand: deviceBrand,
      os_version: osVersion,
      is_emulator: isEmulator,
      battery_level: Number.isFinite(batteryLevel) ? batteryLevel : null,
      free_storage_mb: Number.isFinite(freeStorageMb) ? freeStorageMb : null,
      app_build_number: appBuildNumber,
      invocation_method: invocationMethod,
      duration_ms: Number.isFinite(durationMs) ? durationMs : null,
    };

    console.log("[ingest] Forwarding reportData.description:", JSON.stringify(reportData.description));

    if (syncForwarding) {
      let forwardResult: ForwardResult = null;
      try {
        forwardResult = await forwardToTracker(project.id, event, reportData, attachments);
      } catch (err) {
        console.error("[ingest] forwardToTracker error:", err);
        forwardResult = { error: String(err) };
      }

      console.log("[ingest] ════ Done (sync) ═══ forwarding:", JSON.stringify(forwardResult));

      return NextResponse.json(
        {
          id: event.id,
          created_at: event.created_at,
          forwarding_status: "completed",
          forwarding: forwardResult,
        },
        { status: 201, headers: corsHeaders }
      );
    }

    after(async () => {
      try {
        const forwardResult = await forwardToTracker(project.id, event, reportData, attachments);
        console.log("[ingest] ════ Async forward done ═══", JSON.stringify(forwardResult));
      } catch (err) {
        console.error("[ingest] async forwardToTracker error:", err);
      }
    });

    console.log("[ingest] ════ Done (queued) ═══");

    return NextResponse.json(
      {
        id: event.id,
        created_at: event.created_at,
        forwarding_status: "queued",
        forwarding: null,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (err) {
    console.error("[ingest] Unexpected error:", err);
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400, headers: corsHeaders }
    );
  }
}

// ─── Tracker Forwarding ──────────────────────────────────────────────

type ForwardResult = { provider?: string; key?: string; url?: string; error?: string } | null;

async function forwardToTracker(
  projectId: string,
  event: { id: string; created_at: string },
  reportData: Record<string, unknown>,
  attachments: Attachments
): Promise<ForwardResult> {
  // Fetch ALL integrations for this project (not just one)
  const { data: integrationRows, error: intError } = await supabase
    .from("integrations")
    .select("provider, vault_secret_id, config")
    .eq("project_id", projectId);

  if (intError) {
    const msg = `Failed to fetch integrations: ${intError.message}`;
    console.error("[ingest]", msg);
    return { error: msg };
  }
  if (!integrationRows || integrationRows.length === 0) {
    console.log("[ingest] No integrations found for project", projectId);
    return { error: "no_integrations" };
  }

  const title = (reportData.title as string) || "Untitled report";
  let lastResult: ForwardResult = null;

  // Forward to EVERY connected integration
  for (const integration of integrationRows) {
    try {
      // Read API token from Vault
      const { data: secrets, error: secretError } = await supabase.rpc("read_secret", {
        secret_id: integration.vault_secret_id,
      });

      if (secretError) {
        const msg = `Failed to read secret for ${integration.provider}: ${secretError.message}`;
        console.error("[ingest]", msg);
        lastResult = { provider: integration.provider, error: msg };
        continue;
      }

      const apiToken = Array.isArray(secrets)
        ? secrets[0]?.decrypted_secret
        : secrets?.decrypted_secret;
      
      if (!apiToken) {
        const msg = `No API token found for ${integration.provider}`;
        console.error("[ingest]", msg);
        lastResult = { provider: integration.provider, error: msg };
        continue;
      }

      const provider = integration.provider as string;
      const config = (integration.config as Record<string, string>) ?? {};

      let externalId: string | null = null;
      let externalKey: string | null = null;
      let externalUrl: string | null = null;

      if (provider === "linear") {
        console.log("[ingest] Forwarding to Linear...");
        const r = await forwardToLinear(apiToken, config.team_id, title, reportData, attachments);
        if (r) {
          externalId = r.id;
          externalKey = r.identifier;
          externalUrl = r.url;
          console.log("[ingest] Linear issue created:", r.identifier);
          lastResult = { provider: "linear", key: r.identifier, url: r.url };
        } else {
          console.error("[ingest] Linear forwarding returned null");
          lastResult = { provider: "linear", error: "forwarding_failed" };
        }
      } else if (provider === "jira") {
        console.log("[ingest] Forwarding to Jira...", { siteUrl: config.team_id, email: config.email, projectKey: config.project_key });
        const r = await forwardToJira(apiToken, config.team_id, config.email, config.project_key, title, reportData, attachments);
        if (r) {
          externalId = r.id;
          externalKey = r.key;
          externalUrl = r.url;
          console.log("[ingest] Jira issue created:", r.key);
          lastResult = { provider: "jira", key: r.key, url: r.url };
        } else {
          console.error("[ingest] Jira forwarding returned null");
          lastResult = { provider: "jira", error: "forwarding_failed" };
        }
      } else {
        console.log("[ingest] Unknown provider:", provider);
        lastResult = { provider, error: "unknown_provider" };
      }

      if (externalId) {
        await supabase
          .from("report_events")
          .update({
            external_issue_id: externalId,
            external_issue_key: externalKey,
            external_issue_url: externalUrl,
          })
          .eq("id", event.id);
      }
    } catch (err) {
      console.error(`[ingest] Error forwarding to ${integration.provider}:`, err);
      lastResult = { provider: integration.provider, error: String(err) };
    }
  }

  return lastResult;
}

function buildJiraDescription(
  e: Record<string, unknown>,
  attachments: Attachments
): string {
  console.log("[ingest] buildJiraDescription — e.description:", JSON.stringify(e.description), "type:", typeof e.description);
  const lines: string[] = [
    (e.description as string) || "No additional details provided.",
    "",
    "Context:",
    `- Reported At: ${e.stopped_at || new Date().toISOString()}`,
    `- Capture Mode: ${(e.capture_mode as string) === "video" ? "Video" : "Screenshot"}`,
    `- Page URL: ${e.page_url || "Unknown"}`,
  ];

  const hasAttachments =
    attachments.screenshot || attachments.video || attachments.networkLogs || attachments.metadata;
  if (hasAttachments) {
    lines.push("", "Attachments:");
    if (attachments.screenshot) lines.push("- Screenshot attached");
    if (attachments.video) lines.push("- Screen recording attached");
    if (attachments.networkLogs) lines.push("- Network logs attached (network-logs.txt)");
    if (attachments.consoleLogs) lines.push("- Console logs attached (console-logs.txt)");
    if (attachments.metadata) lines.push("- Client metadata attached (client-metadata.json)");
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

function buildLinearDescription(
  e: Record<string, unknown>,
  attachments: Attachments,
  mediaLinks: { screenshotUrl: string | null; videoUrl: string | null }
): string {
  const lines: string[] = [
    (e.description as string) || "No additional details provided.",
    "",
    "### Context",
    `- Reported At: ${e.stopped_at || new Date().toISOString()}`,
    `- Capture Mode: ${(e.capture_mode as string) === "video" ? "Video" : "Screenshot"}`,
    `- Page URL: ${e.page_url || "Unknown"}`,
    "",
  ];

  if (mediaLinks.screenshotUrl || mediaLinks.videoUrl) {
    lines.push("### Media");
    if (mediaLinks.screenshotUrl) {
      lines.push(`- Screenshot: [Open screenshot](${mediaLinks.screenshotUrl})`);
    }
    if (mediaLinks.videoUrl) {
      lines.push(`- Recording: [Open recording](${mediaLinks.videoUrl})`);
    }
    lines.push("");
  }

  if (attachments.networkLogs || attachments.consoleLogs || attachments.metadata) {
    lines.push("*Network logs and client metadata are attached as comments below.*");
  }

  return lines.join("\n");
}

// ─── Linear Forwarding (with attachments) ────────────────────────────

async function forwardToLinear(
  apiKey: string,
  teamId: string | undefined,
  title: string,
  reportData: Record<string, unknown>,
  attachments: Attachments
): Promise<{ id: string; identifier: string; url: string } | null> {
  // 1) Upload media to Linear and get asset URLs
  let screenshotUrl: string | null = null;
  let videoUrl: string | null = null;

  console.log("[ingest] Linear forwarding — screenshot:", !!attachments.screenshot, "video:", !!attachments.video);

  if (attachments.screenshot) {
    screenshotUrl = await linearUploadBuffer(
      apiKey,
      attachments.screenshot.buffer,
      attachments.screenshot.name || "bug-screenshot.png",
      attachments.screenshot.type || "image/png"
    );
    console.log("[ingest] Screenshot upload result:", screenshotUrl ? "success" : "failed");
  }

  if (attachments.video) {
    videoUrl = await linearUploadBuffer(
      apiKey,
      attachments.video.buffer,
      attachments.video.name || "bug-recording.webm",
      attachments.video.type || "video/webm"
    );
    console.log("[ingest] Video upload result:", videoUrl ? "success" : "failed");
  }

  // 2) Build description matching old Linear format
  const fullDescription = buildLinearDescription(reportData, attachments, {
    screenshotUrl,
    videoUrl,
  });

  // 3) Create issue
  const mutation = `mutation($input:IssueCreateInput!){issueCreate(input:$input){success issue{id identifier url}}}`;
  const variables = {
    input: { title, description: fullDescription, ...(teamId ? { teamId } : {}) },
  };

  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query: mutation, variables }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  const issue = body?.data?.issueCreate?.issue;
  if (!issue) return null;

  // 4) Add network logs, console logs, and metadata as separate comments
  if (attachments.networkLogs) {
    const text = attachments.networkLogs.buffer.toString("utf-8");
    if (text.trim()) {
      await linearAddComment(apiKey, issue.id, "### Network Logs\n```\n" + text.slice(0, 10000) + "\n```");
    }
  }

  if (attachments.consoleLogs) {
    const text = attachments.consoleLogs.buffer.toString("utf-8");
    if (text.trim()) {
      await linearAddComment(apiKey, issue.id, "### Console Logs\n```\n" + text.slice(0, 10000) + "\n```");
    }
  }

  if (attachments.metadata) {
    const text = attachments.metadata.buffer.toString("utf-8");
    if (text.trim()) {
      await linearAddComment(apiKey, issue.id, "### Client Metadata\n```json\n" + text + "\n```");
    }
  }

  return issue;
}

async function linearUploadBuffer(
  apiKey: string,
  buf: Buffer,
  filename: string,
  contentType: string
): Promise<string | null> {
  try {
    // Request upload target from Linear
    const uploadMutation = `
      mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
        fileUpload(contentType: $contentType, filename: $filename, size: $size) {
          success
          uploadFile { uploadUrl assetUrl headers { key value } }
        }
      }
    `;

    console.log("[ingest] Linear fileUpload request — filename:", filename, "size:", buf.length, "type:", contentType);

    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify({
        query: uploadMutation,
        variables: { contentType, filename, size: buf.length },
      }),
    });

    if (!res.ok) {
      console.error("[ingest] Linear fileUpload failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const body = await res.json();
    const uploadFile = body?.data?.fileUpload?.uploadFile;
    if (!uploadFile?.uploadUrl || !uploadFile?.assetUrl) {
      console.error("[ingest] Linear fileUpload no upload target:", JSON.stringify(body));
      return null;
    }

    // Build upload headers
    const uploadHeaders: Record<string, string> = {};
    if (Array.isArray(uploadFile.headers)) {
      for (const h of uploadFile.headers) {
        if (h.key && h.value) uploadHeaders[h.key] = h.value;
      }
    }

    // PUT the file to the signed URL (convert Buffer to Uint8Array for fetch compatibility)
    const putRes = await fetch(uploadFile.uploadUrl, {
      method: "PUT",
      headers: uploadHeaders,
      body: new Uint8Array(buf),
    });

    if (!putRes.ok) {
      console.error("[ingest] Linear PUT upload failed:", putRes.status);
      return null;
    }
    console.log("[ingest] Linear file uploaded successfully:", uploadFile.assetUrl);
    return uploadFile.assetUrl;
  } catch {
    return null;
  }
}

async function linearAddComment(
  apiKey: string,
  issueId: string,
  body: string
): Promise<void> {
  try {
    const mutation = `mutation($input:CommentCreateInput!){commentCreate(input:$input){success}}`;
    await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify({
        query: mutation,
        variables: { input: { issueId, body } },
      }),
    });
  } catch {
    // Non-critical
  }
}

// ─── Jira Forwarding ─────────────────────────────────────────────────

async function forwardToJira(
  apiToken: string,
  siteUrl: string | undefined,
  email: string | undefined,
  projectKey: string | undefined,
  title: string,
  reportData: Record<string, unknown>,
  attachments: Attachments
): Promise<{ id: string; key: string; url: string } | null> {
  if (!siteUrl || !email) {
    console.error("[ingest] Jira missing siteUrl or email");
    return null;
  }
  if (!projectKey) {
    console.error("[ingest] Jira missing project_key in config — cannot create issue");
    return null;
  }

  // Strip protocol prefix if user entered full URL (e.g. "https://siroco.atlassian.net")
  const cleanSiteUrl = siteUrl.replace(/^https?:\/\//, "");

  const basicAuth = Buffer.from(`${email}:${apiToken}`).toString("base64");
  const authHeader = `Basic ${basicAuth}`;

  // Build description in ADF format matching old Jira integration style
  const descText = buildJiraDescription(reportData, attachments);
  const adfDescription = toJiraAdf(descText);

  // 1) Create the issue
  console.log("[ingest] Jira API URL:", `https://${cleanSiteUrl}/rest/api/3/issue`);
  const res = await fetch(`https://${cleanSiteUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary: title,
        description: adfDescription,
        issuetype: { name: "Bug" },
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[ingest] Jira issue creation failed:", res.status, errBody);
    return null;
  }
  const body = await res.json();
  const issueKey = body.key;
  const issueId = body.id;
  console.log("[ingest] Jira issue created:", issueKey);

  // 2) Upload attachments to the created issue
  const filesToUpload: { buf: Buffer; filename: string; contentType: string }[] = [];

  if (attachments.screenshot) {
    filesToUpload.push({
      buf: attachments.screenshot.buffer,
      filename: attachments.screenshot.name || "bug-screenshot.png",
      contentType: attachments.screenshot.type || "image/png",
    });
  }
  if (attachments.video) {
    filesToUpload.push({
      buf: attachments.video.buffer,
      filename: attachments.video.name || "bug-recording.webm",
      contentType: attachments.video.type || "video/webm",
    });
  }
  if (attachments.consoleLogs) {
    filesToUpload.push({
      buf: attachments.consoleLogs.buffer,
      filename: "console-logs.txt",
      contentType: "text/plain",
    });
  }
  if (attachments.networkLogs) {
    filesToUpload.push({
      buf: attachments.networkLogs.buffer,
      filename: "network-logs.txt",
      contentType: "text/plain",
    });
  }
  if (attachments.metadata) {
    filesToUpload.push({
      buf: attachments.metadata.buffer,
      filename: "client-metadata.json",
      contentType: "application/json",
    });
  }

  await Promise.all(
    filesToUpload.map(async (file) => {
      try {
        const fd = new FormData();
        fd.append("file", new Blob([new Uint8Array(file.buf)], { type: file.contentType }), file.filename);

        const attachRes = await fetch(
          `https://${cleanSiteUrl}/rest/api/3/issue/${issueKey}/attachments`,
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "X-Atlassian-Token": "no-check",
            },
            body: fd,
          }
        );
        if (!attachRes.ok) {
          console.error(`[ingest] Jira attachment upload failed for ${file.filename}:`, attachRes.status);
        } else {
          console.log(`[ingest] Jira attachment uploaded: ${file.filename}`);
        }
      } catch (err) {
        console.error(`[ingest] Jira attachment error for ${file.filename}:`, err);
      }
    })
  );

  return { id: issueId, key: issueKey, url: `https://${cleanSiteUrl}/browse/${issueKey}` };
}

// ─── CORS preflight ──────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
