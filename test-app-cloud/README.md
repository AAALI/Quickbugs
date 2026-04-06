# test-app-cloud

Test app connected directly to **QuickBugs Cloud** (Cloudflare deployment). No local proxy needed.

## Setup

```bash
cp .env.example .env
# Fill in VITE_QUICKBUGS_PROJECT_KEY and VITE_QUICKBUGS_ENDPOINT in .env
pnpm dev
```

Opens at [http://localhost:5175](http://localhost:5175).

## What it tests

- Direct cloud integration without a local proxy
- Library CSS works alongside Tailwind v3
- End-to-end bug submission to production endpoint
