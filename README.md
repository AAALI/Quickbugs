# QuickBugs SDK

Open source bug reporting SDK for React, Vue, and vanilla JS apps.

Captures screenshots, recordings, console logs, and network requests.
Forwards reports directly to Jira, Linear, or GitHub Issues.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| `packages/react` | `quick-bug-reporter-react` | React SDK |
| `packages/core` | `quick-bug-reporter-core` | Shared capture logic |
| `packages/mcp` | `quick-bug-reporter-mcp` | MCP client for AI agents |

## Quick start

```bash
npm install quick-bug-reporter-react
```

```tsx
import { CloudIntegration, BugReporterProvider, FloatingBugButton, BugReporterModal } from 'quick-bug-reporter-react'
import 'quick-bug-reporter-react/styles.css'

const cloud = new CloudIntegration({ projectKey: 'your-project-key' })

export default function App() {
  return (
    <BugReporterProvider integrations={{ cloud }} defaultProvider="cloud">
      {/* your app */}
      <FloatingBugButton />
      <BugReporterModal />
    </BugReporterProvider>
  )
}
```

## Platform

The QuickBugs platform (dashboard, AI summaries, MCP backend, release analytics)
is a commercial product at [quickbugs.com](https://quickbugs.com).

This SDK is the open source capture layer that connects to it.

## Licence

MIT — see [LICENSE](./LICENSE)
