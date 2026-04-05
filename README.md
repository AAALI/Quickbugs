# QuickBugs SDK

> Open-source bug reporting for modern web apps — screenshot, screen recording, console logs, and one-click submission to Jira, Linear, or custom backends.

[![npm version](https://img.shields.io/npm/v/quick-bug-reporter-react.svg)](https://www.npmjs.com/package/quick-bug-reporter-react)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

---

## Features

- **Screenshot Capture** — Full-page or region selection with annotation
- **Screen Recording** — Screen + microphone via MediaRecorder API
- **Auto Diagnostics** — Captures console logs, JS errors, network requests
- **Structured Reports** — Guided UI for Steps/Expected/Actual/Context
- **Zero Config** — Drop-in `<FloatingBugButton />` component
- **Multiple Integrations** — Jira, Linear, custom backends, or QuickBugs Cloud
- **Tailwind Compatible** — Works with Tailwind v3, v4, or no framework
- **Multi-Framework** — React, Vue 3, and vanilla JS packages

---

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`packages/react`](./packages/react) | [`quick-bug-reporter-react`](https://www.npmjs.com/package/quick-bug-reporter-react) | React components + hooks |
| [`packages/vue`](./packages/vue) | [`quick-bug-reporter-vue`](https://www.npmjs.com/package/quick-bug-reporter-vue) | Vue 3 composable wrapper |
| [`packages/vanilla`](./packages/vanilla) | [`quick-bug-reporter`](https://www.npmjs.com/package/quick-bug-reporter) | Vanilla JS / script tag |
| [`packages/core`](./packages/core) | [`@quick-bug-reporter/core`](https://www.npmjs.com/package/@quick-bug-reporter/core) | Framework-agnostic capture engine |

---

## Quick Start

### 1. Install

```bash
npm install quick-bug-reporter-react
# or
pnpm add quick-bug-reporter-react
```

### 2. Choose Your Integration

<details open>
<summary><strong>Option A: Direct Jira Integration (No Backend Required)</strong></summary>

```tsx
import {
  BugReporterProvider,
  FloatingBugButton,
  BugReporterModal,
  JiraIntegration
} from 'quick-bug-reporter-react'
import 'quick-bug-reporter-react/styles.css'

const jira = new JiraIntegration({
  createIssueProxyEndpoint: '/api/jira/create-issue',
  uploadAttachmentProxyEndpoint: '/api/jira/upload-attachment',
  projectKey: 'BUG',
})

export default function App() {
  return (
    <BugReporterProvider integrations={{ jira }} defaultProvider="jira">
      {/* Your app */}
      <FloatingBugButton />
      <BugReporterModal />
    </BugReporterProvider>
  )
}
```

**Proxy Setup:** See [`packages/react/README.md`](./packages/react/README.md) for complete Jira/Linear proxy examples.

</details>

<details>
<summary><strong>Option B: Direct Linear Integration</strong></summary>

```tsx
import { LinearIntegration } from 'quick-bug-reporter-react'

const linear = new LinearIntegration({
  createIssueProxyEndpoint: '/api/linear/create-issue',
  uploadProxyEndpoint: '/api/linear/upload',
  teamId: 'your-team-id',
})

export default function App() {
  return (
    <BugReporterProvider integrations={{ linear }} defaultProvider="linear">
      <FloatingBugButton />
      <BugReporterModal />
    </BugReporterProvider>
  )
}
```

</details>

<details>
<summary><strong>Option C: QuickBugs Cloud (Managed + Analytics)</strong></summary>

```tsx
import { CloudIntegration } from 'quick-bug-reporter-react'

const cloud = new CloudIntegration({
  projectKey: 'your-project-key', // Get from dashboard
})

export default function App() {
  return (
    <BugReporterProvider integrations={{ cloud }} defaultProvider="cloud">
      <FloatingBugButton />
      <BugReporterModal />
    </BugReporterProvider>
  )
}
```

**Benefits:** Centralized dashboard, auto-sync to Jira/Linear, AI summaries, release analytics.

</details>

---

## Documentation

- **[React Package README](./packages/react/README.md)** — Full API, all integrations, proxy setup
- **[Core Package README](./packages/core/README.md)** — Headless usage, custom integrations
- **Examples:**
  - [`test-app-tailwind3`](./test-app-tailwind3) — Vite + React + Tailwind v3 + local proxy
  - [`test-app-cloud`](./test-app-cloud) — Cloud integration example

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Your App                                            │
│  ┌────────────────────────────────────────────────┐ │
│  │ <BugReporterProvider>                          │ │
│  │   <FloatingBugButton />  (triggers capture)    │ │
│  │   <BugReporterModal />   (review & submit)     │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  quick-bug-reporter-react / vue / vanilla            │
│  • UI components + framework bindings               │
│  • JiraIntegration, LinearIntegration, Cloud        │
└─────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  @quick-bug-reporter/core                            │
│  • BugReporter (orchestration)                      │
│  • ScreenshotCapturer (html2canvas-pro)             │
│  • ScreenRecorder (MediaRecorder API)               │
│  • NetworkLogger, ConsoleCapture                    │
└─────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  Integration Targets                                 │
│  • Jira API (via your proxy)                        │
│  • Linear GraphQL (via your proxy)                  │
│  • QuickBugs Cloud API (managed)                    │
└─────────────────────────────────────────────────────┘
```

---

## Development

### Prerequisites

- Node.js 18+
- pnpm 10+

### Local Setup

```bash
git clone https://github.com/AAALI/quickbugs-sdk.git
cd quickbugs-sdk
pnpm install

# Build all packages
pnpm build

# Run test app
cd test-app-tailwind3
pnpm dev
```

### Monorepo Scripts

```bash
pnpm build       # Build all packages
pnpm dev         # Watch mode (auto-rebuild)
pnpm typecheck   # Type checking
```

---

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT — see [LICENSE](./LICENSE)

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability reporting.
