# QuickBugs — AI Agent Contribution Guide

> **Purpose**: This document is the single source of truth for any AI agent (or human) working on this codebase. Read it fully before making ANY changes. It describes the architecture, data flow, every folder's purpose, how to correctly propagate changes, and common pitfalls that have cost hours of debugging.

---

## 1. Project Overview

**QuickBugs** is a **cloud-first bug reporting SDK** shipped as an npm package (`quick-bug-reporter-react`). End users embed it in their React apps. When a user clicks "Report Bug", the SDK captures a screenshot or video, network logs, console logs, client metadata, and a user-provided title + description. It then sends **everything** to a cloud ingestion endpoint, which stores the report in Supabase and forwards it to the user's configured issue tracker (Jira, Linear, or both).

### Key Principle: Cloud-First

The SDK ships three integration classes, but **`CloudIntegration` is the primary path**:

| Integration | Where it runs | Used for |
|---|---|---|
| `CloudIntegration` | Client → Cloud API → Tracker | **Production. This is the default.** |
| `JiraIntegration` | Client → Jira API directly | Legacy/direct mode. Requires CORS proxy. |
| `LinearIntegration` | Client → Linear API directly | Legacy/direct mode. Requires CORS proxy. |

The direct integrations (`JiraIntegration`, `LinearIntegration`) exist for backwards compatibility and for users who don't want to use the cloud. But **all new development should prioritize the cloud path**.

---

## 2. Monorepo Structure

```
Quickbugs/                          ← Root (pnpm workspace + Turborepo)
├── packages/
│   ├── core/                       ← @quick-bug-reporter/core (npm: not published separately)
│   │   └── src/
│   │       ├── types.ts            ← ALL shared TypeScript types + helper functions
│   │       ├── ConsoleCapture.ts   ← Console log + JS error interceptor
│   │       ├── NetworkLogger.ts    ← Fetch interceptor for network request logging
│   │       └── integrations/
│   │           ├── cloud.ts        ← CloudIntegration (FormData → /api/ingest)
│   │           ├── jira.ts         ← JiraIntegration (direct Jira API)
│   │           ├── linear.ts       ← LinearIntegration (direct Linear GraphQL)
│   │           └── index.ts        ← Re-exports all integrations
│   │
│   ├── react/                      ← quick-bug-reporter-react (THE npm package)
│   │   └── src/
│   │       ├── core/
│   │       │   ├── BugReporter.ts          ← Orchestrator: start/stop/submit
│   │       │   ├── BugSession.ts           ← Manages recording/screenshot lifecycle
│   │       │   ├── ScreenRecorder.ts       ← MediaRecorder (screen + mic)
│   │       │   ├── ScreenshotCapturer.ts   ← html2canvas-pro screenshot
│   │       │   └── WebMetadata.ts          ← Collects client environment metadata
│   │       ├── ui/
│   │       │   ├── BugReporterProvider.tsx  ← React context provider (state machine)
│   │       │   ├── BugReporterModal.tsx     ← 2-step wizard UI (review → context)
│   │       │   ├── FloatingBugButton.tsx    ← Floating "Report Bug" button
│   │       │   ├── ScreenshotAnnotator.tsx  ← Drag-to-highlight on screenshots
│   │       │   ├── RegionSelector.tsx       ← Region selection overlay
│   │       │   └── primitives/             ← Headless UI primitives (Button, Dialog, etc.)
│   │       ├── lib/utils.ts                ← cn() helper (clsx + tailwind-merge)
│   │       ├── styles.css                  ← Tailwind v4 source CSS
│   │       └── index.ts                    ← Public API: re-exports everything
│   │
│   └── react-native/              ← Future React Native SDK (stub only)
│       └── src/index.ts
│
├── apps/
│   └── dashboard/                  ← @quickbugs/dashboard (Next.js 16)
│       ├── app/
│       │   ├── api/
│       │   │   ├── ingest/route.ts         ← ** THE INGESTION ENDPOINT **
│       │   │   └── validate-integration/   ← Integration validation endpoint
│       │   ├── (app)/
│       │   │   ├── dashboard/              ← Dashboard pages (project list, analytics)
│       │   │   ├── onboarding/             ← Onboarding wizard (org → project → tracker)
│       │   │   ├── settings/               ← Settings pages
│       │   │   └── docs/                   ← Docs pages
│       │   ├── (auth)/
│       │   │   ├── login/                  ← Login page
│       │   │   └── auth/                   ← Auth callback
│       │   └── layout.tsx, page.tsx, globals.css
│       ├── lib/supabase/
│       │   ├── client.ts           ← Browser Supabase client
│       │   ├── server.ts           ← Server Supabase client (SSR)
│       │   └── middleware.ts       ← Supabase auth middleware helper
│       ├── middleware.ts           ← Next.js middleware (protects /dashboard, /onboarding)
│       └── .env.local              ← Environment variables (SUPABASE_URL, keys, etc.)
│
├── supabase/
│   ├── config.toml                 ← Supabase CLI config
│   ├── functions/
│   │   └── ingest/index.ts         ← Edge Function (Deno) — alternative ingestion path
│   └── migrations/
│       ├── 20260213195617_initial_schema.sql     ← Tables, RLS, indexes
│       ├── 20260214000000_vault_helpers.sql       ← Vault CRUD functions
│       ├── 20260214160000_fix_vault_helpers.sql   ← Vault fix
│       ├── 20260214200000_fix_vault_upsert.sql    ← Vault upsert fix
│       ├── 20260214220000_add_description_column.sql ← Added description to report_events
│       ├── 20260214230000_storage_bucket_and_paths.sql ← Storage bucket + path columns
│       ├── 20260216000000_add_structured_fields.sql ← Added steps_to_reproduce, expected_result, actual_result, additional_context
│       └── 20260217173047_add_storage_lifecycle_policy.sql ← Cleanup function for 7-day file retention
│
├── test-app-tw3/                   ← Test app: Tailwind CSS v3 + Vite + React 19
│   ├── src/App.tsx                 ← Uses CloudIntegration with /api/ingest proxy
│   ├── vite.config.ts              ← Vite proxy: /api/ingest → localhost:3000
│   ├── jira-server-plugin.ts       ← Legacy Vite plugin for direct Jira proxy
│   └── .env                        ← VITE_PROJECT_KEY
│
├── test-app-tw4/                   ← Test app: Tailwind CSS v4 + Vite + React Router
│   └── src/                        ← Multi-page demo: QuickStart, HookDemo, Headless, SampleApp
│
├── test-app-html/                  ← Test app: Plain HTML (no bundler, React via CDN)
│   └── index.html                  ← Uses import maps + library's pre-built ESM
│
├── docs/
│   ├── Brand_Guid.md               ← Brand guidelines
│   ├── PROJECT_PLAN.md             ← Project plan & milestones
│   ├── REACT_NATIVE_SDK.md         ← React Native SDK spec
│   ├── SAAS_PLAN.md                ← SaaS business plan
│   └── USER_JOURNEY.md             ← User journey mapping
│
├── pnpm-workspace.yaml             ← Workspace definition
├── turbo.json                      ← Turborepo task config
├── package.json                    ← Root: pnpm scripts (build, typecheck, dev)
├── README.md                       ← Project README
└── AGENT_GUIDE.md                  ← THIS FILE — AI agent contribution guide
```

---

## 3. Package Dependency Graph

```
@quick-bug-reporter/core            ← Zero runtime deps. Pure TypeScript.
        ↑
        │ (bundled inline via tsup noExternal)
        │
quick-bug-reporter-react            ← THE npm package users install
        ↑                              Dependencies: html2canvas-pro, lucide-react,
        │                              radix-ui, class-variance-authority, clsx, tailwind-merge
        │                              Peer deps: react, react-dom
        │
   ┌────┼────┐
   │    │    │
test-  test- test-app-html
app-   app-  (CDN import)
tw3    tw4
(workspace:*)
```

**CRITICAL**: `quick-bug-reporter-react` bundles `@quick-bug-reporter/core` INLINE (via `noExternal: ["@quick-bug-reporter/core"]` in `tsup.config.ts`). This means:
- Users only install ONE package: `quick-bug-reporter-react`
- Core types and integrations are re-exported from `packages/react/src/index.ts`
- **After changing ANY file in `packages/core/`, you MUST rebuild both core AND react**

### Build Order

```bash
pnpm --filter @quick-bug-reporter/core build   # Must build first
pnpm --filter quick-bug-reporter-react build    # Bundles core inline
```

Or simply: `pnpm build` (Turborepo handles order via `dependsOn: ["^build"]`)

---

## 4. The Complete Bug Report Data Flow

This is the most critical section. Understand this flow completely before touching any code.

### Phase 1: Client-Side Capture (packages/react)

```
User clicks "Report Bug" (FloatingBugButton)
    │
    ▼
BugReporterProvider.captureQuickScreenshot() or startRecording()
    │
    ├── ScreenshotCapturer.capture()     → screenshotBlob (Blob, image/png)
    │   OR
    ├── ScreenRecorder.start() → stop()  → videoBlob (Blob, video/webm)
    │
    ├── NetworkLogger (already running)  → networkLogs (NetworkLogEntry[])
    └── ConsoleCapture (already running) → consoleLogs, jsErrors
    │
    ▼
User sees BugReporterModal (Step 1: Review → Step 2: Context)
    │
    ├── User annotates screenshot (ScreenshotAnnotator → annotatedBlob)
    ├── User types title
    ├── User fills in structured bug details (tab-based UI):
    │   ├── Steps to Reproduce (auto-numbered on Enter)
    │   ├── Expected Result
    │   ├── Actual Result
    │   └── Additional Context
    │   (All optional, 4000 char combined limit)
    ├── User selects provider (Cloud/Jira/Linear)
    │
    ▼
BugReporterProvider.submitReport(title, { stepsToReproduce, expectedResult, actualResult, additionalContext })
    │
    ▼
BugReporter.submit(title, description, { screenshotBlob, metadata, consoleLogs, jsErrors })
    │
    ├── Normalizes description: trim() || "No additional details provided."
    ├── Collects WebMetadata (locale, timezone, viewport, screen, device, connection, etc.)
    ├── Builds BugReportPayload object
    │
    ▼
CloudIntegration.submit(payload, onProgress)
```

### Phase 2: CloudIntegration Serialization (packages/core/src/integrations/cloud.ts)

The `CloudIntegration.submit()` method converts the `BugReportPayload` into a `FormData` object:

```
FormData fields set:
    TEXT FIELDS (fd.set):
    ├── project_key          ← from CloudIntegration constructor options
    ├── title                ← payload.title
    ├── description          ← payload.description (concatenated from structured fields for backward compat)
    ├── steps_to_reproduce   ← payload.stepsToReproduce (optional structured field)
    ├── expected_result      ← payload.expectedResult (optional structured field)
    ├── actual_result        ← payload.actualResult (optional structured field)
    ├── additional_context   ← payload.additionalContext (optional structured field)
    ├── provider             ← "cloud"
    ├── capture_mode         ← "screenshot" or "video"
    ├── has_screenshot       ← "true"/"false"
    ├── has_video            ← "true"/"false"
    ├── has_network_logs     ← "true"/"false"
    ├── has_console_logs     ← "true"/"false"
    ├── js_error_count       ← number as string
    ├── user_agent           ← navigator.userAgent
    ├── browser_name         ← parsed from UA
    ├── os_name              ← parsed from UA
    ├── device_type          ← "desktop"/"tablet"/"mobile"
    ├── screen_resolution    ← "1920x1080"
    ├── viewport             ← "1440x900"
    ├── color_scheme         ← "light"/"dark"/""
    ├── locale               ← "en-US"
    ├── timezone             ← "Asia/Dubai"
    ├── connection_type      ← "4g"/""
    ├── page_url             ← window.location.href
    ├── environment          ← "development"/"staging"/"production"
    └── stopped_at           ← ISO timestamp of when capture stopped

    FILE FIELDS (fd.append):
    ├── screenshot           ← Blob (image/png), filename "bug-screenshot.png"
    ├── video                ← Blob (video/webm), filename "bug-recording.webm"
    ├── network_logs         ← Blob (text/plain), formatted NetworkLogEntry[], filename "network-logs.txt"
    ├── console_logs         ← Blob (text/plain), formatted console+errors, filename "console-logs.txt"
    └── metadata             ← Blob (application/json), full BugClientMetadata, filename "client-metadata.json"
```

Then POSTs to `this.endpoint` (default `/api/ingest`).

### Phase 3: Cloud Ingestion (apps/dashboard/app/api/ingest/route.ts)

The Next.js API route receives the FormData and processes it in this order:

```
1. Parse FormData
   ├── Iterate ALL entries (text → Record<string,string>, blobs → Record<string,Blob>)
   ├── Log every field for debugging
   └── Extract named variables from iterated maps

2. Validate
   ├── Check project_key exists
   ├── Look up project in Supabase (projects table)
   ├── Check project is active
   └── Rate limit check (report_events count in last minute)

3. Read file blobs into Node.js Buffers
   ├── screenshot → Buffer + name + type
   ├── video → Buffer + name + type
   ├── network_logs → Buffer
   ├── console_logs → Buffer
   └── metadata → Buffer

4. INSERT into report_events (Supabase DB)
   ├── All text fields (title, description, metadata columns)
   ├── Boolean flags derived from actual file presence
   └── Returns: { id, created_at }

5. Upload attachments to Supabase Storage
   ├── Bucket: "report-attachments"
   ├── Path: {project_id}/{event_id}/{filename}
   └── Update report_events with storage paths

6. Forward to connected trackers
   ├── Read integrations table for this project
   ├── Read API token from Vault (read_secret RPC)
   ├── For each integration:
   │   ├── Jira: Create issue (REST API v3 + ADF), upload attachments
   │   └── Linear: Upload media (GraphQL), create issue, add comments
   └── Update report_events with external_issue_id/key/url

7. Return JSON response
   └── { id, created_at, forwarding: { provider, key, url, error? } }
```

### Phase 4: SDK Response Parsing (packages/core/src/integrations/cloud.ts)

```
CloudIntegration parses response:
    ├── result.forwarding.key  → issueKey (e.g., "KAN-42")
    ├── result.forwarding.url  → issueUrl (e.g., "https://siroco.atlassian.net/browse/KAN-42")
    └── Falls back to QB-{id} if no forwarding
```

---

## 5. Database Schema (Supabase)

### Tables

| Table | Purpose |
|---|---|
| `organizations` | Multi-tenant orgs (name, slug, plan) |
| `members` | Links auth.users → organizations (role: owner/member) |
| `projects` | Each org has projects with unique `project_key` (e.g., `qb_wvw73zh91j5a`) |
| `integrations` | Tracker configs per project (provider, vault_secret_id, config JSONB) |
| `report_events` | Every bug report submitted through the SDK |

### `report_events` Columns

```sql
id                  UUID PRIMARY KEY
project_id          UUID → projects(id)
title               TEXT NOT NULL
description         TEXT                    -- Legacy/concatenated field (backward compat)
steps_to_reproduce  TEXT                    -- Structured: Steps to reproduce the bug
expected_result     TEXT                    -- Structured: What was expected to happen
actual_result       TEXT                    -- Structured: What actually happened
additional_context  TEXT                    -- Structured: Additional context/notes
provider            TEXT NOT NULL           -- "cloud", "jira", "linear"
capture_mode        TEXT NOT NULL           -- "screenshot" or "video"
has_screenshot      BOOLEAN
has_video           BOOLEAN
has_network_logs    BOOLEAN
has_console_logs    BOOLEAN
js_error_count      INT
external_issue_id   TEXT                    -- Jira/Linear issue ID
external_issue_key  TEXT                    -- e.g., "KAN-42"
external_issue_url  TEXT                    -- Full URL to tracker issue
user_agent          TEXT
browser_name        TEXT
os_name             TEXT
device_type         TEXT
screen_resolution   TEXT
viewport            TEXT
color_scheme        TEXT
locale              TEXT
timezone            TEXT
connection_type     TEXT
page_url            TEXT
environment         TEXT
status              TEXT DEFAULT 'success'
error_message       TEXT
duration_ms         INT
screenshot_path     TEXT                    -- Supabase Storage path
video_path          TEXT                    -- Supabase Storage path
network_logs_path   TEXT                    -- Supabase Storage path
console_logs_path   TEXT                    -- Supabase Storage path
metadata_path       TEXT                    -- Supabase Storage path
created_at          TIMESTAMPTZ
```

### Supabase Storage

- **Bucket**: `report-attachments` (private, 50MB limit)
- **Path pattern**: `{project_id}/{event_id}/{filename}`
- **Files stored**: bug-screenshot.png, bug-recording.webm, network-logs.txt, console-logs.txt, client-metadata.json
- **Retention Policy**: Files are automatically deleted after 7 days
  - Files are forwarded to Jira/Linear immediately on report submission
  - 7-day retention provides buffer for failed forwarding retries and manual recovery
  - Cleanup runs daily at 2 AM UTC via `cleanup-old-attachments` Edge Function (cron)

### Vault (API Token Storage)

API tokens for Jira/Linear are stored in Supabase Vault (encrypted). Access via:
- `create_secret(name, secret)` → returns UUID
- `read_secret(secret_id)` → returns `{ decrypted_secret }`
- `update_secret(secret_id, new_secret)`
- `delete_secret(secret_id)`

The `integrations.vault_secret_id` column references the Vault secret UUID.

### RLS (Row Level Security)

- All tables have RLS enabled
- `report_events` INSERT: service_role only (no anon/authenticated INSERT policy)
- The `/api/ingest` route uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
- Dashboard queries use the authenticated user's session
- `user_org_ids()` helper function scopes all SELECT policies to the user's orgs

---

## 6. How to Add/Change Bug Report Fields

**This is the most common task and the most error-prone.** A field must be propagated through the ENTIRE chain. Missing any step causes silent data loss.

### Example: Adding a new field `custom_tag`

You must update ALL of these files, in order:

#### Step 1: Core Types (`packages/core/src/types.ts`)
Add the field to `BugReportPayload`:
```typescript
export type BugReportPayload = {
  // ...existing fields...
  customTag: string | null;  // NEW
};
```

#### Step 2: React — BugReporter (`packages/react/src/core/BugReporter.ts`)
Include the field in the payload object built in `submit()`:
```typescript
const payload = {
  // ...existing fields...
  customTag: options.customTag ?? null,  // NEW
};
```

#### Step 3: React — BugReporterProvider (`packages/react/src/ui/BugReporterProvider.tsx`)
Pass the field through `submitReport()` → `reporter.submit()`.

#### Step 4: React — BugReporterModal (`packages/react/src/ui/BugReporterModal.tsx`)
If user-facing, add UI input and pass to `submitReport()`.

#### Step 5: CloudIntegration (`packages/core/src/integrations/cloud.ts`)
Serialize to FormData:
```typescript
fd.set("custom_tag", payload.customTag || "");
```

#### Step 6: Ingest Route (`apps/dashboard/app/api/ingest/route.ts`)
Extract from FormData and include in DB insert + reportData:
```typescript
const customTag = text["custom_tag"] || null;
// ... in insert:
custom_tag: customTag,
// ... in reportData:
custom_tag: customTag,
```

#### Step 7: Database Migration (`supabase/migrations/`)
Create a new timestamped migration:
```sql
ALTER TABLE public.report_events ADD COLUMN custom_tag TEXT;
```

#### Step 8: Push Migration
```bash
npx supabase db push --linked
```

#### Step 9: Description Builders (if the field should appear in Jira/Linear issues)
Update `buildJiraDescription()` and `buildLinearDescription()` in `route.ts`.

#### Step 10: Rebuild Packages
```bash
pnpm build
```

**If you skip ANY step, the field will silently be lost.** The most common failure mode is updating the SDK but forgetting the ingest route, or vice versa.

---

## 7. Build System

### Tools
- **pnpm** v10.14.0 — Package manager (workspace protocol `workspace:*`)
- **Turborepo** — Orchestrates builds across packages
- **tsup** — TypeScript bundler for packages/core and packages/react
- **Next.js 16** — Dashboard app framework
- **Vite 7** — Test app dev server

### Build Commands

| Command | What it does |
|---|---|
| `pnpm build` | Builds ALL packages (Turbo handles order) |
| `pnpm --filter @quick-bug-reporter/core build` | Build core only |
| `pnpm --filter quick-bug-reporter-react build` | Build react (includes core) |
| `pnpm --filter test-app-tw3 dev` | Start test app (port 5174) |
| `pnpm --filter @quickbugs/dashboard dev` | Start dashboard (port 3000) |

### tsup Configuration

**Core** (`packages/core/tsup.config.ts`):
- Entry: `src/index.ts`
- Format: ESM + CJS
- DTS: yes
- No external bundling (pure package)

**React** (`packages/react/tsup.config.ts`):
- Entry: `src/index.ts`
- Format: ESM + CJS
- DTS: yes
- `external: ["react", "react-dom"]` — peer deps not bundled
- `noExternal: ["@quick-bug-reporter/core"]` — core IS bundled inline
- Banner: `"use client"` for Next.js compatibility
- CSS built separately via `scripts/build-css.mjs` (Tailwind v4 CLI)

### After Making Changes

| What you changed | What to rebuild |
|---|---|
| `packages/core/src/**` | `pnpm build` (both core + react) |
| `packages/react/src/**` | `pnpm --filter quick-bug-reporter-react build` |
| `apps/dashboard/**` | Nothing (Next.js hot-reloads in dev) |
| `supabase/migrations/**` | `npx supabase db push --linked` |
| Test app files | Nothing (Vite hot-reloads) |

**CRITICAL**: After rebuilding packages, you may need to restart the Vite test app to clear its `optimizeDeps` cache:
```bash
# Kill existing Vite server, then:
rm -rf test-app-tw3/node_modules/.vite
pnpm --filter test-app-tw3 dev
```

---

## 8. Test Apps

### test-app-tw3 (Primary Test App)

- **Purpose**: Primary testing ground for the cloud integration flow
- **Stack**: Vite + React 19 + Tailwind CSS v3
- **Port**: 5174
- **Config**: `test-app-tw3/vite.config.ts`
- **Proxy**: `/api/ingest` → `http://localhost:3000` (Next.js dashboard)
- **Integration**: `CloudIntegration` with `projectKey: "qb_wvw73zh91j5a"`

**To test the full cloud flow:**
1. Start the dashboard: `pnpm --filter @quickbugs/dashboard dev` (port 3000)
2. Start test-app-tw3: `pnpm --filter test-app-tw3 dev` (port 5174)
3. Open `http://localhost:5174`
4. Click "Report Bug" → capture → fill form → submit
5. Check Next.js terminal for `[ingest]` logs
6. Check Supabase `report_events` table
7. Check Jira/Linear for the created issue

**Legacy proxy**: `jira-server-plugin.ts` provides Vite middleware endpoints (`/api/jira/create-issue`, `/api/jira/upload-attachment`) for the old direct `JiraIntegration`. These read from `.env` vars `VITE_JIRA_BASE_URL`, `VITE_JIRA_EMAIL`, `VITE_JIRA_API_TOKEN`.

### test-app-tw4 (Documentation/Demo App)

- **Purpose**: Multi-page demo showcasing different integration patterns
- **Stack**: Vite + React 19 + Tailwind CSS v4 + React Router
- **Pages**: HomePage, QuickStartPage, HookDemoPage, HeadlessPage, SampleAppPage
- **Note**: More of a showcase than a functional test app. Uses `workspace:*` link.

### test-app-html (Plain HTML Test)

- **Purpose**: Proves the library works WITHOUT any bundler or Tailwind installation
- **Stack**: Plain HTML + React via CDN (esm.sh import maps)
- **Note**: References `../packages/react/dist/` directly. No build step needed.

---

## 9. Environment Variables

### Dashboard (`apps/dashboard/.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://mfqexjfdrbnqrqgatnwx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...   ← Required for /api/ingest
```

### Test App tw3 (`test-app-tw3/.env`)

```
VITE_PROJECT_KEY=qb_wvw73zh91j5a
# Legacy Jira direct integration vars (optional):
VITE_JIRA_BASE_URL=https://siroco.atlassian.net
VITE_JIRA_EMAIL=...
VITE_JIRA_API_TOKEN=...
```

---

## 10. Supabase Details

- **Project ref**: `mfqexjfdrbnqrqgatnwx`
- **Project URL**: `https://mfqexjfdrbnqrqgatnwx.supabase.co`
- **CLI**: Linked. Use `npx supabase db push --linked` to push migrations.
- **Auth**: Email/password via Supabase Auth
- **Storage bucket**: `report-attachments` (private)

### Migration Naming Convention

```
supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql
```

Use the current UTC date+time. Example: `20260215120000_add_priority_field.sql`.

### Important: Service Role Key

The `/api/ingest` route uses `SUPABASE_SERVICE_ROLE_KEY` (not the anon key) because:
1. `report_events` has no INSERT policy for anon/authenticated users
2. Storage uploads need service role to bypass RLS
3. Vault `read_secret` requires service role

**Never expose the service role key to the client.**

---

## 11. Common Pitfalls & Known Issues

### Pitfall 1: FormData Proxy Quirks

When the Vite dev server proxies FormData to Next.js, file entries may arrive as `Blob` instead of `File`. The ingest route now iterates `fd.entries()` and checks `instanceof Blob` (not `instanceof File`). **Never** use `instanceof File` checks on the server side.

### Pitfall 2: Stale Vite Cache

Vite caches pre-bundled dependencies in `node_modules/.vite/`. After rebuilding packages, the test app may still use stale code. Fix:
```bash
rm -rf test-app-tw3/node_modules/.vite
# Restart Vite dev server
```

### Pitfall 3: Package Not Linked

If the test app shows errors about missing modules, ensure:
1. `package.json` uses `"workspace:*"` (not a version number or `"file:..."`)
2. The package is listed in `pnpm-workspace.yaml`
3. Run `pnpm install` from the repo root

### Pitfall 4: Next.js Route Not Reloading

Next.js 16 generally hot-reloads API routes in dev mode, but occasionally requires a restart. If changes to `route.ts` don't take effect, restart the Next.js dev server.

### Pitfall 5: Description "No additional details provided."

If the description shows this default value in Jira/Linear despite the user typing one, the description is being lost somewhere in the chain. Check the Next.js terminal for `[ingest]` logs — the route logs the exact description value at every step.

### Pitfall 6: Forgetting to Rebuild

Changes to `packages/core/` or `packages/react/` require a rebuild before they take effect in test apps or the dashboard. The source files are NOT used directly — only the built `dist/` files.

---

## 12. Key File Quick Reference

### If you need to change...

| What | Primary file(s) |
|---|---|
| Bug report payload shape | `packages/core/src/types.ts` (BugReportPayload) |
| What data the SDK sends | `packages/core/src/integrations/cloud.ts` (FormData fields) |
| How the server processes reports | `apps/dashboard/app/api/ingest/route.ts` |
| What gets stored in the DB | `route.ts` INSERT + a new migration |
| What appears in Jira issues | `route.ts` → `buildJiraDescription()` + `forwardToJira()` |
| What appears in Linear issues | `route.ts` → `buildLinearDescription()` + `forwardToLinear()` |
| The bug report UI/modal | `packages/react/src/ui/BugReporterModal.tsx` |
| State management / flow | `packages/react/src/ui/BugReporterProvider.tsx` |
| Screenshot capture | `packages/react/src/core/ScreenshotCapturer.ts` |
| Video recording | `packages/react/src/core/ScreenRecorder.ts` |
| Network logging | `packages/core/src/NetworkLogger.ts` |
| Console capture | `packages/core/src/ConsoleCapture.ts` |
| Client metadata collection | `packages/react/src/core/WebMetadata.ts` |
| Database schema | `supabase/migrations/` |
| Supabase auth/RLS | `supabase/migrations/20260213195617_initial_schema.sql` |
| Vault (API token storage) | `supabase/migrations/20260214000000_vault_helpers.sql` |
| Dashboard UI components | `apps/dashboard/components/` |
| Dashboard onboarding | `apps/dashboard/app/(app)/onboarding/` |

---

## 13. Integration Config (integrations table)

Each tracker integration is stored in the `integrations` table with a `config` JSONB column:

### Jira Config
```json
{
  "team_id": "siroco.atlassian.net",
  "email": "user@example.com",
  "project_key": "KAN"
}
```
- `team_id` = Jira site URL (may include `https://` prefix — the route strips it)
- `email` = Jira account email (used with API token for Basic Auth)
- `project_key` = Jira project key (e.g., "KAN", "BUG")

### Linear Config
```json
{
  "team_id": "abc123-uuid-of-linear-team"
}
```
- `team_id` = Linear team UUID

---

## 14. Development Workflow Summary

### Starting from scratch
```bash
cd /Users/aliabdulkadirali/Code/Quickbugs
pnpm install
pnpm build

# Terminal 1: Dashboard (serves /api/ingest)
pnpm --filter @quickbugs/dashboard dev

# Terminal 2: Test app
pnpm --filter test-app-tw3 dev

# Open http://localhost:5174
```

### After making SDK changes
```bash
pnpm build                              # Rebuild all packages
rm -rf test-app-tw3/node_modules/.vite  # Clear Vite cache
# Restart Vite dev server if needed
```

### After making DB changes
```bash
# Create migration file in supabase/migrations/
npx supabase db push --linked           # Push to remote
# Restart Next.js if needed
```

### Debugging the cloud flow
1. Watch the Next.js terminal for `[ingest]` log lines
2. The route logs ALL FormData text fields and file sizes
3. Check Supabase Table Editor → `report_events` for stored data
4. Check Supabase Storage → `report-attachments` bucket for files
5. Check Jira/Linear for created issues

---

## 15. What NOT to Do

1. **Never edit `dist/` files** — they are build artifacts
2. **Never hardcode API keys** in source files
3. **Never use `fd.get()` in the ingest route** — iterate `fd.entries()` instead (proxy quirk)
4. **Never add a field to only one layer** — it must go through the entire chain (Section 6)
5. **Never delete migrations** — only add new ones
6. **Never use `instanceof File` server-side** — use `instanceof Blob`
7. **Never skip rebuilding** after changing package source files
8. **Never modify `pnpm-lock.yaml` manually** — let pnpm manage it
