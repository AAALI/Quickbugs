# Plain HTML Test App

Tests the bug reporter library **without any bundler or Tailwind CSS** — just plain HTML, CSS, and React via CDN.

## Run

```bash
# From the repo root:
npx serve test-app-html -l 3002

# Or from inside this directory:
npx serve . -l 3002
```

Then open [http://localhost:3002](http://localhost:3002).

> **Note:** This app is for **visual/CSS testing only**. It has no backend proxy,
> so Linear/Jira submission won't work here. Use `test-app-tw3` or `test-app-tw4`
> for end-to-end submission testing.

## What it proves

- Library CSS works as a standalone `<link>` tag
- No Tailwind v3/v4 dependency required
- Floating button renders fixed at bottom-right
- Modal dialog opens with correct styling
- Colors, spacing, and positioning all resolve without CSS custom properties
