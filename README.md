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
- **Private by Default** — Passwords, one-time codes, and payment fields are masked with no configuration
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
| [`packages/ingest`](./packages/ingest) | [`@quick-bug-reporter/ingest`](https://www.npmjs.com/package/@quick-bug-reporter/ingest) | Server-side ingest contract, parser, and handler |

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

## Privacy

Sensitive fields are masked before a screenshot is ever encoded, with no
configuration required:

| Masked by default | Why |
|---|---|
| `input[type="password"]`, current/new password fields | Credentials |
| `input[autocomplete="one-time-code"]` | MFA codes |
| `input[autocomplete^="cc-"]`, card number / CVV / CVC fields | Payment instruments |
| Stripe payment iframes | Cross-origin content we cannot inspect |

Credential-bearing URL parameters (`access_token`, `api_key`, `code`, signed-URL
signatures, and OAuth `#access_token=` fragments) are stripped from network
logs, the reported page URL, and any tracker issue description.

Request and response bodies are **not captured at all** unless you opt in, and
authentication endpoints are never body-captured regardless of configuration.

```tsx
const cloud = new CloudIntegration({
  projectKey: 'your-project-key',
  privacy: {
    // Added to the built-in defaults — never replaces them.
    maskSelectors: ['.customer-address'],
    blockSelectors: ['.internal-notes'],
    redactLogKeys: ['accountNumber'],
    urlDepth: 2, // /users/12345/orders/98765 → /users/.../
  },
})
```

Mark elements inline without touching config:

```html
<div data-quickbugs-mask>Blurred in screenshots</div>
<div data-quickbugs-block>Replaced with a placeholder</div>
```

## Architecture

The capture engine lives in one place. The framework packages are thin bindings
over it — they must not fork it.

```text
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
│  • UI components + framework bindings only          │
│  • Re-exports the engine below; owns no capture code│
└─────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  @quick-bug-reporter/core                            │
│  • BugReporter, BugSession   (orchestration)        │
│  • ScreenshotCapturer        (html2canvas-pro)      │
│  • ScreenRecorder            (MediaRecorder API)    │
│  • NetworkLogger, ConsoleCapture, BreadcrumbCapture │
│  • privacy                   (masking + redaction)  │
│  • Jira / Linear / Cloud integrations               │
└─────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  Integration Targets                                 │
│  • Jira API (via your proxy)                        │
│  • Linear GraphQL (via your proxy)                  │
│  • QuickBugs ingest (hosted or self-hosted)         │
└─────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  @quick-bug-reporter/ingest        (server side)     │
│  • The wire contract both sides compile against     │
│  • Parsing, limits, origin rules, idempotency       │
│  • Storage injected — hosted and self-hosted share  │
│    one implementation                                │
└─────────────────────────────────────────────────────┘
```

## Running your own ingest

The SDK can post to your own server instead of QuickBugs Cloud. The handler is
published, so you implement four storage methods and nothing else:

```ts
import { createIngestHandler } from '@quick-bug-reporter/ingest'

const handler = createIngestHandler({ store: yourStore })
```

A working Supabase deployment — schema, Edge Function, RLS, retention — is in
[`supabase/`](./supabase), including an honest list of what it does not do yet.

---

## Development

### Prerequisites

- Node.js 18+
- pnpm 10+

### Local Setup

```bash
git clone https://github.com/AAALI/Quickbugs.git
cd Quickbugs
pnpm install

# Build all packages
pnpm build

# Run test app
cd test-app-tailwind3
pnpm dev
```

### Monorepo Scripts

```bash
pnpm build             # Build all packages
pnpm dev               # Watch mode (auto-rebuild)
pnpm typecheck         # Type checking
pnpm test              # Run the test suite
pnpm test:watch        # Tests in watch mode
pnpm test:coverage     # Tests with coverage report
pnpm verify:packaging  # Pack each package, fail on a missing entry point
pnpm verify            # Everything CI runs, in one command
```

Run `pnpm verify` before opening a pull request — it is the same gate CI
applies.

### Where to put a change

The capture engine is shared. A fix to screenshots, recording, network logging,
or privacy belongs in `packages/core` and reaches all three framework packages
at once. `packages/react`, `packages/vue`, and `packages/vanilla` should contain
only UI and framework bindings.

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
