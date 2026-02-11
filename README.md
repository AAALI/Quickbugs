# quick-bug-reporter-react

Drop-in bug reporter for React apps — screenshot capture, video recording, annotation, and Linear/Jira integration.

## Features

- **Screenshot capture** — Full-page or region selection via `html2canvas-pro`
- **Video recording** — Screen + microphone via `MediaRecorder` API
- **Annotation** — Drag-to-highlight on captured screenshots
- **Network logging** — Automatic fetch interception during capture
- **Integrations** — Linear and Jira (direct API or backend proxy)
- **Zero config UI** — Floating bug button + modal wizard, ships its own styles

## Install

```bash
npm install quick-bug-reporter-react
# or
pnpm add quick-bug-reporter-react
```

## Requirements

- React 18+ or 19+

## Quick Start

### 1. Import styles

The library ships a **self-contained, pre-built CSS file** that works with any setup — Tailwind v3, Tailwind v4, or no Tailwind at all.

Import it once in your app entry point:

```ts
import "quick-bug-reporter-react/styles.css";
```

> **Tailwind v3 users:** The CSS file is already fully resolved — no Tailwind v4
> theme variables or `@layer` blocks that could conflict with your v3 pipeline.
> Just import as shown above and it works.
>
> **Tailwind v4 users:** The import above works out of the box. Alternatively you
> can add `@source "node_modules/quick-bug-reporter-react/dist";` to your main
> CSS file so Tailwind picks up the library's utility classes directly.
>
> **No Tailwind?** The import above is all you need. If your bundler doesn't
> handle CSS imports, add a `<link>` tag pointing to the file in `node_modules`:
> ```html
> <link rel="stylesheet" href="/node_modules/quick-bug-reporter-react/dist/styles.css" />
> ```

### 2. Add the provider and UI

```tsx
import {
  BugReporterProvider,
  FloatingBugButton,
  BugReporterModal,
  JiraIntegration,
} from "quick-bug-reporter-react";

const jira = new JiraIntegration({
  createIssueProxyEndpoint: "/api/jira/create-issue",
  uploadAttachmentProxyEndpoint: "/api/jira/upload-attachment",
  projectKey: "BUG",
});

export default function App({ children }) {
  return (
    <BugReporterProvider
      integrations={{ jira }}
      defaultProvider="jira"
    >
      {children}
      <FloatingBugButton />
      <BugReporterModal />
    </BugReporterProvider>
  );
}
```

That's it — a floating "Report Bug" button appears in the bottom-right corner.

## Integrations

### Jira

```ts
import { JiraIntegration } from "quick-bug-reporter-react";

// ✅ Recommended: split proxy endpoints (parallel uploads, fastest)
const jira = new JiraIntegration({
  createIssueProxyEndpoint: "/api/jira/create-issue",
  uploadAttachmentProxyEndpoint: "/api/jira/upload-attachment",
  projectKey: "BUG",
  issueType: "Bug", // optional, defaults to "Bug"
});
```

| Option | Description |
|--------|-------------|
| `projectKey` | Jira project key (e.g. `"BUG"`) |
| `issueType` | Issue type name, defaults to `"Bug"` |
| `createIssueProxyEndpoint` | Proxy for issue creation (recommended) |
| `uploadAttachmentProxyEndpoint` | Proxy for attachment uploads (recommended) |
| `submitProxyEndpoint` | Single endpoint fallback (slower — see [below](#legacy-single-endpoint)) |
| `baseUrl` | Jira instance URL (direct mode only — not for browser SPAs) |
| `email` | Jira email (direct mode only) |
| `apiToken` | Jira API token (direct mode only) |
| `fetchImpl` | Custom fetch implementation |

### Linear

```ts
import { LinearIntegration } from "quick-bug-reporter-react";

// ✅ Recommended: split proxy endpoints (parallel uploads, fastest)
const linear = new LinearIntegration({
  createIssueProxyEndpoint: "/api/linear/create-issue",
  uploadProxyEndpoint: "/api/linear/upload",
  teamId: "TEAM_ID",
  projectId: "PROJECT_ID", // optional — assigns issues to a Linear project
});
```

| Option | Description |
|--------|-------------|
| `teamId` | Linear team ID |
| `projectId` | Linear project ID — optional, assigns every issue to this project |
| `createIssueProxyEndpoint` | Proxy for issue creation (recommended) |
| `uploadProxyEndpoint` | Proxy for file uploads (recommended) |
| `submitProxyEndpoint` | Single endpoint fallback (slower — see [below](#legacy-single-endpoint)) |
| `apiKey` | Linear API key (direct mode only — not for browser SPAs) |
| `fetchImpl` | Custom fetch implementation |

---

### Proxy endpoint contract (split endpoints)

With split endpoints the library handles formatting and **uploads attachments in parallel** — your proxy only needs to forward auth. This is ~3× faster than a single endpoint.

#### `createIssueProxyEndpoint`

Receives a JSON POST:

```json
{
  "summary": "Bug title",                  // Jira
  "title": "Bug title",                    // Linear
  "description": "Pre-formatted description (ready to use as-is)",
  "issueType": "Bug",                      // Jira only
  "projectKey": "BUG",                     // Jira only
  "teamId": "...",                          // Linear only
  "projectId": "..."                        // Linear only (if configured)
}
```

Must return:

```json
// Jira
{ "id": "10001", "key": "BUG-42", "url": "https://you.atlassian.net/browse/BUG-42" }

// Linear
{ "id": "...", "identifier": "ENG-123", "url": "https://linear.app/..." }
```

#### `uploadAttachmentProxyEndpoint` (Jira)

Receives `FormData` with `issueKey` (string) + `file` (File). Returns `{ "ok": true }`.

#### `uploadProxyEndpoint` (Linear)

Receives `FormData` with `file` (File) + `filename` (string) + `contentType` (string). Returns `{ "assetUrl": "https://..." }`.

#### Example: Jira proxy (Node.js / Express)

```ts
// POST /api/jira/create-issue — forward issue creation with auth
app.post("/api/jira/create-issue", express.json(), async (req, res) => {
  const { summary, description, issueType, projectKey } = req.body;

  // Convert plain-text description to Jira ADF
  const adf = {
    type: "doc", version: 1,
    content: description.split(/\n{2,}/).filter(Boolean).map(chunk => ({
      type: "paragraph",
      content: [{ type: "text", text: chunk.trim() }],
    })),
  };

  const jiraRes = await fetch(`${JIRA_BASE}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary,
        description: adf,
        issuetype: { name: issueType || "Bug" },
      },
    }),
  });

  const data = await jiraRes.json();
  res.status(jiraRes.ok ? 201 : jiraRes.status).json(
    jiraRes.ok
      ? { id: data.id, key: data.key, url: `${JIRA_BASE}/browse/${data.key}` }
      : { error: data.errorMessages?.join("; ") || "Jira issue creation failed" }
  );
});

// POST /api/jira/upload-attachment — forward file upload with auth
app.post("/api/jira/upload-attachment", upload.single("file"), async (req, res) => {
  const issueKey = req.body.issueKey;
  const form = new FormData();
  form.append("file", req.file.buffer, req.file.originalname);

  const jiraRes = await fetch(`${JIRA_BASE}/rest/api/3/issue/${issueKey}/attachments`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`)}`,
      "X-Atlassian-Token": "no-check",
    },
    body: form,
  });

  res.status(jiraRes.ok ? 200 : jiraRes.status).json(
    jiraRes.ok ? { ok: true } : { error: "Upload failed" }
  );
});
```

#### Example: Linear proxy (Node.js / Express)

Linear uses a **GraphQL API**. Your proxy forwards mutations to `https://api.linear.app/graphql` with the API key server-side.

```ts
const LINEAR_API = "https://api.linear.app/graphql";
const LINEAR_API_KEY = process.env.LINEAR_API_KEY; // e.g. "lin_api_..."

// Helper: execute a Linear GraphQL mutation
async function linearGql(query: string, variables: Record<string, unknown>) {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      Authorization: LINEAR_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors?.length) {
    throw new Error(body.errors?.[0]?.message || `Linear API error (${res.status})`);
  }
  return body.data;
}

// POST /api/linear/create-issue — create issue via GraphQL
app.post("/api/linear/create-issue", express.json(), async (req, res) => {
  const { title, description, teamId, projectId } = req.body;

  try {
    const data = await linearGql(
      `mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier url }
        }
      }`,
      {
        input: {
          title,
          description,
          teamId,
          ...(projectId ? { projectId } : {}),
        },
      }
    );

    const issue = data.issueCreate.issue;
    res.status(201).json({
      id: issue.id,
      identifier: issue.identifier,
      url: issue.url,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/linear/upload — upload file via GraphQL fileUpload + PUT
app.post("/api/linear/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  const contentType = req.body.contentType || file.mimetype;
  const filename = req.body.filename || file.originalname;

  try {
    // 1. Request an upload URL from Linear
    const data = await linearGql(
      `mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
        fileUpload(contentType: $contentType, filename: $filename, size: $size) {
          success
          uploadFile { uploadUrl assetUrl headers { key value } }
        }
      }`,
      { contentType, filename, size: file.size }
    );

    const { uploadUrl, assetUrl, headers } = data.fileUpload.uploadFile;

    // 2. PUT the file to the upload URL with Linear's signed headers
    const uploadHeaders: Record<string, string> = {};
    for (const h of headers) uploadHeaders[h.key] = h.value;

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: uploadHeaders,
      body: file.buffer,
    });

    if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);

    res.json({ assetUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

> **Key points for Linear proxy implementers:**
> - The `create-issue` endpoint receives `{ title, description, teamId, projectId }` — use these directly in the `IssueCreateInput` GraphQL mutation. The `description` is already pre-formatted by the library.
> - The `upload` endpoint must: (1) call `fileUpload` mutation to get a signed upload URL, (2) `PUT` the file binary to that URL with the returned headers, (3) return the `assetUrl`.
> - `projectId` is optional — only include it in the mutation input if it's present in the request body.

---

### Legacy: single endpoint

`submitProxyEndpoint` bundles everything into one request. The proxy must create the issue **and** upload all attachments server-side, which means uploads happen sequentially and are **~3× slower**. Use split endpoints above instead when possible.

<details>
<summary>Single endpoint FormData fields (click to expand)</summary>

| Field | Type | Always sent | Description |
|-------|------|:-----------:|-------------|
| `provider` | string | Yes | `"linear"` or `"jira"` |
| `title` | string | Yes | Issue title |
| `description` | string | Yes | **Pre-formatted** issue description (ready to use as-is) |
| `issueType` | string | Jira only | Issue type (e.g. `"Bug"`) |
| `projectKey` | string | Jira only | Jira project key (if configured) |
| `teamId` | string | Linear only | Linear team ID (if configured) |
| `projectId` | string | Linear only | Linear project ID (if configured) |
| `screenshotFile` | File | If screenshot | `bug-screenshot.png` |
| `screenRecordingFile` | File | If video | `bug-recording.webm` |
| `networkLogsFile` | File | Yes | `network-logs.txt` |
| `clientMetadataFile` | File | Yes | `client-metadata.json` |
| `consoleLogsFile` | File | If present | `console-logs.txt` (JS errors + console output) |

**Jira response:** `{ "jira": { "id": "...", "key": "BUG-42", "url": "..." }, "warnings": [] }`

**Linear response:** `{ "linear": { "id": "...", "identifier": "ENG-123", "url": "..." }, "warnings": [] }`

</details>

### Advanced: Custom fetch

Both integrations accept a `fetchImpl` option to customize how HTTP requests are made (useful for adding auth headers, logging, or proxying):

```ts
const linear = new LinearIntegration({
  apiKey: "...",
  teamId: "...",
  fetchImpl: (input, init) => {
    console.log("Request:", input);
    return fetch(input, init);
  },
});
```

## Exports

### UI Components

- `BugReporterProvider` — Context provider, wraps your app
- `FloatingBugButton` — Floating action button with capture menu
- `BugReporterModal` — Two-step wizard (review capture → add context & submit)
- `useBugReporter()` — Hook to build custom UI on top of the bug reporter

### Core Classes (headless usage)

- `BugReporter` — Orchestrates capture + submission (no UI)
- `BugSession` — Manages a single capture session
- `ScreenshotCapturer` — HTML-to-canvas screenshot engine
- `ScreenRecorder` — Screen + mic recording via MediaRecorder
- `NetworkLogger` — Fetch interception logger

### Integrations

- `LinearIntegration` — Linear issue creation + file upload
- `JiraIntegration` — Jira issue creation + attachment upload

## License

MIT
