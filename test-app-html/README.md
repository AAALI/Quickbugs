# Plain HTML Test App

Tests the bug reporter library **without any bundler or Tailwind CSS** — just plain HTML, CSS, and React via CDN.

## Run

```bash
# From this directory, serve with any static server:
npx serve .
# or
python3 -m http.server 3002
```

Then open [http://localhost:3002](http://localhost:3002) (or whatever port your server uses).

## What it proves

- Library CSS works as a standalone `<link>` tag
- No Tailwind v3/v4 dependency required
- Floating button renders fixed at bottom-right
- Modal dialog opens with correct styling
- Colors, spacing, and positioning all resolve without CSS custom properties
