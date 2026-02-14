import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * POST /api/validate-integration
 * Tests whether the provided credentials can authenticate with the tracker.
 * Body: { provider, apiToken, email?, siteUrl?, projectKey?, teamId? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, apiToken, email, siteUrl, projectKey, teamId } = body;

    if (!provider || !apiToken) {
      return NextResponse.json(
        { valid: false, error: "Missing provider or API token." },
        { status: 400, headers: corsHeaders }
      );
    }

    if (provider === "jira") {
      return await validateJira(apiToken, email, siteUrl, projectKey);
    } else if (provider === "linear") {
      return await validateLinear(apiToken, teamId);
    }

    return NextResponse.json(
      { valid: false, error: `Unknown provider: ${provider}` },
      { status: 400, headers: corsHeaders }
    );
  } catch (err) {
    return NextResponse.json(
      { valid: false, error: String(err) },
      { status: 500, headers: corsHeaders }
    );
  }
}

async function validateJira(
  apiToken: string,
  email?: string,
  siteUrl?: string,
  projectKey?: string
) {
  if (!email || !siteUrl) {
    return NextResponse.json(
      { valid: false, error: "Jira requires email and site URL." },
      { headers: corsHeaders }
    );
  }

  // Strip protocol prefix if present
  const cleanUrl = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const basicAuth = Buffer.from(`${email}:${apiToken}`).toString("base64");

  // Step 1: Verify authentication
  const meRes = await fetch(`https://${cleanUrl}/rest/api/3/myself`, {
    headers: {
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
    },
  });

  if (!meRes.ok) {
    const errText = await meRes.text().catch(() => "");
    if (meRes.status === 401) {
      return NextResponse.json(
        { valid: false, error: "Authentication failed. Check your email and API token." },
        { headers: corsHeaders }
      );
    }
    return NextResponse.json(
      { valid: false, error: `Jira returned ${meRes.status}: ${errText.slice(0, 200)}` },
      { headers: corsHeaders }
    );
  }

  const me = await meRes.json();

  // Step 2: If project key provided, verify it exists and we can create issues
  if (projectKey) {
    const projectRes = await fetch(
      `https://${cleanUrl}/rest/api/3/project/${projectKey}`,
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/json",
        },
      }
    );

    if (!projectRes.ok) {
      return NextResponse.json(
        {
          valid: false,
          error: `Project "${projectKey}" not found or not accessible. Check the project key.`,
        },
        { headers: corsHeaders }
      );
    }
  }

  return NextResponse.json(
    {
      valid: true,
      message: `Authenticated as ${me.displayName ?? me.emailAddress ?? email}${projectKey ? ` · Project ${projectKey} accessible` : ""}`,
    },
    { headers: corsHeaders }
  );
}

async function validateLinear(apiToken: string, teamId?: string) {
  // Test with a simple viewer query
  const query = `{ viewer { id name email } }`;
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiToken,
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { valid: false, error: "Authentication failed. Check your Linear API key." },
      { headers: corsHeaders }
    );
  }

  const body = await res.json();
  const viewer = body?.data?.viewer;

  if (!viewer) {
    return NextResponse.json(
      { valid: false, error: "Could not verify Linear credentials." },
      { headers: corsHeaders }
    );
  }

  // If team ID provided, verify it exists
  if (teamId) {
    const teamQuery = `{ team(id: "${teamId}") { id name } }`;
    const teamRes = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiToken,
      },
      body: JSON.stringify({ query: teamQuery }),
    });
    const teamBody = await teamRes.json();
    if (!teamBody?.data?.team) {
      return NextResponse.json(
        { valid: false, error: `Team ID "${teamId}" not found.` },
        { headers: corsHeaders }
      );
    }
  }

  return NextResponse.json(
    {
      valid: true,
      message: `Authenticated as ${viewer.name ?? viewer.email}`,
    },
    { headers: corsHeaders }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
