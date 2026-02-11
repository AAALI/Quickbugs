# Tailwind v3 Test App

Tests the bug reporter library inside a **Tailwind CSS v3** project with PostCSS.

## Setup

```bash
npm install
npm run dev
```

Opens at [http://localhost:5174](http://localhost:5174).

## What it proves

- Library CSS (`styles.css`) works when imported through a Tailwind v3 + PostCSS pipeline
- No `@layer` or `var(--color-*)` conflicts with Tailwind v3's output
- Floating button is fixed at bottom-right with correct colors/spacing
- The host app's own Tailwind v3 classes render correctly alongside library styles
