import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const body = await req.json();
    const { project_key, ...reportData } = body;

    if (!project_key) {
      return Response.json(
        { error: "Missing project_key." },
        { status: 400, headers: corsHeaders },
      );
    }

    // Service-role client — bypasses RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate project key
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, is_active, rate_limit_per_min")
      .eq("project_key", project_key)
      .single();

    if (projectError || !project) {
      return Response.json(
        { error: "Invalid project key." },
        { status: 401, headers: corsHeaders },
      );
    }

    if (!project.is_active) {
      return Response.json(
        { error: "Project is inactive." },
        { status: 403, headers: corsHeaders },
      );
    }

    // Rate limit check
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabase
      .from("report_events")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .gte("created_at", oneMinuteAgo);

    if ((count ?? 0) >= project.rate_limit_per_min) {
      return Response.json(
        { error: "Rate limit exceeded." },
        { status: 429, headers: corsHeaders },
      );
    }

    // Insert report event
    const { data: event, error: insertError } = await supabase
      .from("report_events")
      .insert({
        project_id: project.id,
        title: reportData.title || "Untitled report",
        provider: reportData.provider || "manual",
        capture_mode: reportData.capture_mode || "screenshot",
        has_screenshot: reportData.has_screenshot ?? false,
        has_video: reportData.has_video ?? false,
        has_network_logs: reportData.has_network_logs ?? false,
        has_console_logs: reportData.has_console_logs ?? false,
        js_error_count: reportData.js_error_count ?? 0,
        external_issue_id: reportData.external_issue_id,
        external_issue_key: reportData.external_issue_key,
        external_issue_url: reportData.external_issue_url,
        user_agent: reportData.user_agent,
        browser_name: reportData.browser_name,
        browser_version: reportData.browser_version,
        os_name: reportData.os_name,
        os_version: reportData.os_version,
        device_type: reportData.device_type,
        screen_resolution: reportData.screen_resolution,
        viewport: reportData.viewport,
        color_scheme: reportData.color_scheme,
        locale: reportData.locale,
        timezone: reportData.timezone,
        connection_type: reportData.connection_type,
        page_url: reportData.page_url,
        app_version: reportData.app_version ?? reportData.appVersion,
        environment: reportData.environment,
        platform: reportData.platform,
        device_model: reportData.device_model,
        device_brand: reportData.device_brand,
        is_emulator: reportData.is_emulator,
        battery_level: reportData.battery_level,
        free_storage_mb: reportData.free_storage_mb,
        app_build_number: reportData.app_build_number,
        invocation_method: reportData.invocation_method,
        status: reportData.status || "success",
        error_message: reportData.error_message,
        duration_ms: reportData.duration_ms,
      })
      .select("id, created_at, project_id")
      .single();

    if (insertError) {
      return Response.json(
        { error: "Failed to store report." },
        { status: 500, headers: corsHeaders },
      );
    }

    // Trigger tracker forwarding asynchronously (non-blocking)
    forwardToTracker(supabase, project.id, event).catch(() => {});

    return Response.json(
      { id: event.id, created_at: event.created_at },
      { status: 201, headers: corsHeaders },
    );
  } catch {
    return Response.json(
      { error: "Invalid request body." },
      { status: 400, headers: corsHeaders },
    );
  }
});

// ─── Tracker Forwarding ──────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function forwardToTracker(supabase: any, projectId: string, event: any) {
  // Get integration for this project
  const { data: integration } = await supabase
    .from("integrations")
    .select("provider, vault_secret_id, config")
    .eq("project_id", projectId)
    .limit(1)
    .single();

  if (!integration) return;

  // Get the API token from Vault
  const { data: secrets } = await supabase.rpc("read_secret", {
    secret_id: integration.vault_secret_id,
  });

  const apiToken = Array.isArray(secrets)
    ? secrets[0]?.decrypted_secret
    : secrets?.decrypted_secret;
  if (!apiToken) return;

  const provider = integration.provider as string;
  const config = (integration.config as Record<string, string>) ?? {};

  const description = buildDescription(event);
  let externalIssueId: string | null = null;
  let externalIssueKey: string | null = null;
  let externalIssueUrl: string | null = null;

  if (provider === "linear") {
    const result = await forwardToLinear(apiToken, config.team_id, event.title, description);
    if (result) {
      externalIssueId = result.id;
      externalIssueKey = result.identifier;
      externalIssueUrl = result.url;
    }
  } else if (provider === "jira") {
    const result = await forwardToJira(apiToken, config.team_id, config.email, event.title, description);
    if (result) {
      externalIssueId = result.id;
      externalIssueKey = result.key;
      externalIssueUrl = result.url;
    }
  }

  // Update report with external issue reference
  if (externalIssueId) {
    await supabase
      .from("report_events")
      .update({
        external_issue_id: externalIssueId,
        external_issue_key: externalIssueKey,
        external_issue_url: externalIssueUrl,
      })
      .eq("id", event.id);
  }
}

// deno-lint-ignore no-explicit-any
function buildDescription(event: any): string {
  return [
    `**Bug Report** from QuickBugs`,
    "",
    `- **Page:** ${event.page_url || "N/A"}`,
    `- **Browser:** ${event.browser_name || "N/A"}`,
    `- **OS:** ${event.os_name || "N/A"}`,
    `- **Device:** ${event.device_type || "N/A"}`,
    `- **Capture:** ${event.capture_mode || "N/A"}`,
    `- **Environment:** ${event.environment || "N/A"}`,
  ].join("\n");
}

async function forwardToLinear(
  apiKey: string,
  teamId: string | undefined,
  title: string,
  description: string,
): Promise<{ id: string; identifier: string; url: string } | null> {
  const mutation = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url }
      }
    }
  `;

  const variables: Record<string, unknown> = {
    input: {
      title,
      description,
      ...(teamId ? { teamId } : {}),
    },
  };

  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  if (!res.ok) return null;

  const body = await res.json();
  return body?.data?.issueCreate?.issue ?? null;
}

async function forwardToJira(
  apiToken: string,
  siteUrl: string | undefined,
  email: string | undefined,
  title: string,
  description: string,
): Promise<{ id: string; key: string; url: string } | null> {
  if (!siteUrl || !email) return null;

  const basicAuth = btoa(`${email}:${apiToken}`);

  const res = await fetch(`https://${siteUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      fields: {
        summary: title,
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: description }],
            },
          ],
        },
        issuetype: { name: "Bug" },
      },
    }),
  });

  if (!res.ok) return null;

  const body = await res.json();
  return {
    id: body.id,
    key: body.key,
    url: `https://${siteUrl}/browse/${body.key}`,
  };
}
