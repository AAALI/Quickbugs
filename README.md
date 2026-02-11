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

The library ships a pre-built CSS file. Import it once in your app entry point:

```ts
import "quick-bug-reporter-react/styles.css";
```

> **Already using Tailwind CSS v4?** You can skip the CSS import and instead add
> `@source "node_modules/quick-bug-reporter-react/dist";` to your main CSS file so
> Tailwind picks up the library's utility classes.

### 2. Add the provider and UI

```tsx
import {
  BugReporterProvider,
  FloatingBugButton,
  BugReporterModal,
  LinearIntegration,
} from "quick-bug-reporter-react";

const linear = new LinearIntegration({
  submitProxyEndpoint: "/api/bug-report",
});

export default function App({ children }) {
  return (
    <BugReporterProvider
      integrations={{ linear }}
      defaultProvider="linear"
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

Both integrations support two modes:

| Mode | When to use | How it works |
|------|------------|--------------|
| **Backend proxy** (recommended) | Production apps | Your server-side endpoint receives the report and calls Linear/Jira. API keys stay on the server. |
| **Direct API** | Server-side only (Next.js API routes, etc.) | The library calls Linear/Jira APIs directly. **⚠️ Does NOT work from browser-only SPAs due to CORS.** |

### Linear

```ts
import { LinearIntegration } from "quick-bug-reporter-react";

// ✅ Recommended: Backend proxy (works everywhere)
const linear = new LinearIntegration({
  submitProxyEndpoint: "/api/bug-report",
});

// ⚠️ Direct API — server-side / Next.js API routes only
// Does NOT work from browser SPAs (CORS + exposes API key)
const linear = new LinearIntegration({
  apiKey: "lin_api_...",
  teamId: "TEAM_ID",
  projectId: "PROJECT_ID", // optional
});
```

### Jira

```ts
import { JiraIntegration } from "quick-bug-reporter-react";

// ✅ Recommended: Backend proxy
const jira = new JiraIntegration({
  submitProxyEndpoint: "/api/bug-report",
});

// ⚠️ Direct API — server-side only (CORS + exposes credentials)
const jira = new JiraIntegration({
  baseUrl: "https://your-domain.atlassian.net",
  email: "you@example.com",
  apiToken: "...",
  projectKey: "BUG",
  issueType: "Bug", // optional, defaults to "Bug"
});
```

### Proxy endpoint

Your backend proxy receives a `FormData` POST with these fields:

| Field | Type | Description |
|-------|------|-------------|
| `provider` | string | `"linear"` or `"jira"` |
| `title` | string | Bug title |
| `description` | string | Bug description |
| `pageUrl` | string | URL where the bug was reported |
| `userAgent` | string | Browser user agent |
| `captureMode` | string | `"screenshot"` or `"video"` |
| `clientMetadata` | JSON string | Device/browser metadata |
| `networkLogs` | string | Formatted network logs |
| `screenshotFile` | File | Screenshot PNG (if applicable) |
| `screenRecordingFile` | File | Screen recording WebM (if applicable) |
| `requestsLogFile` | File | Network logs as .txt |

The proxy should return JSON:

```json
{
  "linear": { "id": "...", "identifier": "ENG-123", "url": "https://..." },
  "warnings": []
}
```

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
