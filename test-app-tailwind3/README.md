# test-app-tailwind3

End-to-end test app for the bug reporter library with **Tailwind CSS v3** + PostCSS.

## Setup

```bash
pnpm install
pnpm dev
```

Opens at [http://localhost:5174](http://localhost:5174).

## What it tests

- Library CSS (`styles.css`) works through a Tailwind v3 + PostCSS pipeline
- No `@layer` or `var(--color-*)` conflicts with Tailwind v3's output
- Floating button renders fixed at bottom-right with correct styling
- Local Jira/Linear proxy via Vite dev server
