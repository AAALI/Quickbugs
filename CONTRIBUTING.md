# Contributing to QuickBugs SDK

Thank you for contributing.

## What lives here

This repo contains the open source capture SDK only.
The platform (dashboard, AI features, billing) is a separate private repository.

## Getting started

```bash
pnpm install
pnpm build
```

## Submitting changes

1. Fork the repo
2. Create a branch: `git checkout -b fix/your-fix-name`
3. Make your changes
4. Run `pnpm build` — must pass
5. Open a pull request with a clear description

## SDK packages

- `packages/core` — shared types, logging, network capture. No React dependency.
- `packages/react` — React wrapper. Depends on core.
- `packages/mcp` — MCP client. Connects to the QuickBugs platform API.

## Feature requests

For features that require platform changes (dashboard, AI, analytics),
open an issue and label it `platform-feature`. These are tracked separately.
