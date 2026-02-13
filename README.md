# QuickBugs 🐞

Lightweight bug reporting infrastructure for Jira and Linear teams. Forward bugs. See patterns. Ship faster.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`quick-bug-reporter-react`](./packages/react) | [![npm](https://img.shields.io/npm/v/quick-bug-reporter-react)](https://www.npmjs.com/package/quick-bug-reporter-react) | Drop-in bug reporter for React web apps |
| [`quick-bug-reporter-react-native`](./packages/react-native) | *Coming soon* | Shake-to-report bug reporter for React Native apps |

### Internal packages

| Package | Description |
|---------|-------------|
| [`@quick-bug-reporter/core`](./packages/core) | Shared types, network logger, console capture, and integrations (private — never published to npm) |

## Monorepo Structure

```
quickbugs/
├── packages/
│   ├── core/               # Shared logic (types, NetworkLogger, ConsoleCapture, integrations)
│   ├── react/              # Web SDK — React 18+/19+
│   └── react-native/       # Mobile SDK — React Native (scaffold)
├── apps/                   # Dashboard + landing page (coming soon)
├── test-app-html/          # Minimal HTML test app
├── test-app-tw3/           # Tailwind v3 test app
├── test-app-tw4/           # Tailwind v4 test app
├── turbo.json              # Turborepo task config
├── pnpm-workspace.yaml     # pnpm workspace definition
├── PROJECT_PLAN.md         # Master roadmap
├── SAAS_PLAN.md            # SaaS backend architecture
└── REACT_NATIVE_SDK.md     # RN SDK research & plan
```

## Development

### Prerequisites

- **Node.js** 18+
- **pnpm** 10+

### Setup

```bash
pnpm install
```

### Build all packages

```bash
pnpm build
```

### Typecheck all packages

```bash
pnpm typecheck
```

### Build a single package

```bash
pnpm --filter quick-bug-reporter-react build
pnpm --filter @quick-bug-reporter/core build
```

## Architecture

The `@quick-bug-reporter/core` package contains platform-agnostic logic shared by both SDKs:

- **Types** — `BugReportPayload`, `BugSessionArtifacts`, `BugClientMetadata`, etc.
- **NetworkLogger** — Fetch interception for capturing network requests
- **ConsoleCapture** — Console log and JS error capture
- **Integrations** — Linear and Jira issue creation + file upload

Each SDK (`react`, `react-native`) bundles the core at build time via tsup's `noExternal` — consumers only install one package.

## Documentation

- **[Web SDK (React)](./packages/react/README.md)** — Full usage docs, integration setup, proxy examples
- **[Project Plan](./PROJECT_PLAN.md)** — Master roadmap (phases, status, ETAs)
- **[User Journey](./USER_JOURNEY.md)** — End-to-end onboarding flow with wireframes
- **[SaaS Plan](./SAAS_PLAN.md)** — Backend architecture, data model, security
- **[Brand Guide](./Brand_Guid.md)** — QuickBugs brand identity and copy rules
- **[React Native SDK Plan](./REACT_NATIVE_SDK.md)** — Research, architecture, and implementation phases

## License

MIT
