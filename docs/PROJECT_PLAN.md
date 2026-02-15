# Project Plan — QuickBugs 🐞

> **Priority order:** Landing page + auth + onboarding → Edge Function + CloudIntegration → Dashboard + beta launch → React Native SDK → Billing + growth.
>
> Brand reference: [`Brand_Guid.md`](./Brand_Guid.md) · User journey: [`USER_JOURNEY.md`](./USER_JOURNEY.md)

---

## Status Overview

| Phase | Status | ETA |
|-------|:------:|:---:|
| **0 — Monorepo Setup** | ✅ Complete | Done |
| **1 — Supabase + Landing + Auth + Onboarding** | ✅ Complete | Done |
| **2 — Edge Function + CloudIntegration** | ✅ Complete | Done |
| **3 — Dashboard + Beta Launch** | 🚧 In Progress | 1-2 weeks |
| **4 — React Native SDK** | 🚧 In Progress | 2-3 weeks |
| **5 — Billing + Growth** | 🔲 Ongoing | — |

---

## Phase 0 — Monorepo Setup ✅

Restructured the repo from a single package into a pnpm monorepo with Turborepo.

- [x] Root workspace: `pnpm-workspace.yaml`, `turbo.json`, root `package.json`
- [x] `packages/core/` — shared types, NetworkLogger, ConsoleCapture, Linear/Jira integrations (`private: true`)
- [x] `packages/react/` — full web SDK moved here, all imports rewired to `@quick-bug-reporter/core`
- [x] `packages/react-native/` — scaffold (re-exports core, placeholder for RN-specific code)
- [x] All 3 packages build + typecheck clean
- [x] Test apps (`test-app-tw3`, `test-app-tw4`, `test-app-html`) updated to use local workspace
- [x] README.md split: root = monorepo overview, `packages/react/README.md` = full web SDK docs

---

## Phase 1 — Supabase + Landing + Auth + Onboarding ✅

> **Goal:** Public-facing site + sign-up + onboarding wizard. User goes from landing page to "waiting for first bug report" screen. Supabase schema is deployed because auth and onboarding both need the database.

### 1.1 Supabase Setup

- [x] Create Supabase project
- [x] Run initial migration: 5 tables (`organizations`, `members`, `projects`, `integrations`, `report_events`)
- [x] Configure RLS policies (org-scoped access)
- [x] Set up Vault for encrypted credential storage (Vault helper functions migration)
- [x] Configure Auth providers (magic link email)

### 1.2 App Scaffold

- [x] Create `apps/dashboard/` — Next.js 16 app (landing + dashboard in one)
- [x] Add to `pnpm-workspace.yaml`
- [x] shadcn/ui + Tailwind CSS setup (brand colors)
- [x] Light-first design. Supabase × Linear × Vercel feel.

### 1.3 Landing Page

- [x] Hero section
- [x] How it works section
- [x] No media storage differentiator section
- [x] Analytics preview section
- [x] Encrypted credentials / security section
- [x] Pricing section (free during beta)
- [x] CTAs: "Start Free", "View Docs"
- [x] All copy aligned with [`Brand_Guid.md`](./Brand_Guid.md)

### 1.4 Auth (Magic Link)

- [x] Combined login/signup page — email magic link
- [x] Supabase Auth: `signInWithOtp` (magic link)
- [x] "Check your email" confirmation screen
- [x] Auth callback handler (`/auth/callback`)
- [x] Middleware route guard: unauthenticated → `/login`, authenticated → `/dashboard`

### 1.5 Onboarding Wizard (5 steps)

- [x] **Step 1:** Create organization (name, auto-slug)
- [x] **Step 2:** Create project (name + platform select)
- [x] **Step 3:** Connect tracker (Jira or Linear credentials → Vault, skip option)
- [x] **Step 4:** Install SDK (pre-filled code snippets with project key, copy-to-clipboard)
- [x] **Step 5:** Verify — "Waiting for first bug report" polling screen
- [x] Progress indicator (step N of 5)

**Reference:** Full screen wireframes and flow in [`USER_JOURNEY.md`](./USER_JOURNEY.md)

---

## Phase 2 — Edge Function + CloudIntegration ✅

> **Goal:** Complete the backend. SDK can submit bug reports through the Supabase Edge Function proxy. Onboarding verify step works end-to-end.

### 2.1 Ingest Edge Function

- [x] Create `supabase/functions/ingest/index.ts`
- [x] Validate `X-Project-Key` header → look up project + integration
- [x] Rate limiting via `report_events` count
- [x] Decrypt credentials from Vault
- [x] Forward bug report to Jira/Linear API (create issue + upload attachments)
- [x] Parse `User-Agent` for browser/OS fields
- [x] Log `report_event` row (metadata only, no media stored)
- [x] Return `{ issueId, issueKey, issueUrl }` to SDK
- [x] Next.js API route mirror (`/api/ingest`) with same logic + tracker forwarding

### 2.2 CloudIntegration (SDK)

- [x] Create `packages/core/src/integrations/cloud.ts` — `CloudIntegration` class
- [x] Accepts `projectKey`, `ingestUrl`, `appVersion`, `environment`
- [x] Sends multipart POST to ingest endpoint with all report data
- [x] Re-export from `packages/core/src/index.ts` and both SDK barrels
- [x] Update `BugReporterIntegrations` type to include `cloud` provider

### 2.3 Wire Up Verify + Test Connection

- [x] Onboarding Step 5 polling → checks `report_events` for first report
- [x] End-to-end flow: SDK → Ingest → Jira/Linear issue created → `report_events` row logged

**Reference:** Full architecture, data model, and security details in [`SAAS_PLAN.md`](./SAAS_PLAN.md)

---

## Phase 3 — Dashboard + Beta Launch

> **Goal:** Analytics dashboard, project management, and public beta launch. Free for all users during beta.

### 3.1 Dashboard Layout

- [x] Shared app header (org name, plan badge, settings icon, avatar dropdown)
- [x] Avatar dropdown with user info + logout
- [x] Dashboard overview (stats cards, project list, recent reports table)
- [x] Empty state for projects with no reports
- [x] Loading skeletons (dashboard + settings)
- [x] Project detail page — all reports for a project with filters/search
- [x] Report detail page — full report metadata, external issue link

### 3.2 Project Management

- [x] Organization + project settings (name, slug, plan display)
- [x] Project key display + copy-to-clipboard
- [x] Integration config (connect, rotate API keys via Vault, remove)
- [x] Project settings (rate limit, active/inactive toggle)
- [x] Danger zone (leave org / delete org with confirmation)
- [x] Settings page with sidebar tabs (Profile, Organization, Projects, Integrations, Danger Zone)
- [x] Performance: `getSession()` in pages (middleware handles `getUser()`), fixed query parallelism
- [ ] Team member management (invite, roles, remove)

### 3.3 Analytics Dashboard

- [x] **Bug count over time** — line chart (reports per day/week/month)
- [x] **Browser breakdown** — bar chart
- [x] **OS breakdown** — bar chart
- [ ] **App versions impacted** — table with bug count, first/last seen
- [x] **Top pages** — table ranked by report count
- [x] **Device type split** — desktop / mobile / tablet
- [x] **Capture mode breakdown** — screenshot vs video ratio
- [x] **Success rate** — percentage of reports forwarded
- [ ] Environment filter toggle (production / staging / all)
- [ ] Date range picker

### 3.4 Deploy + Beta Launch

- [ ] Deploy to Cloudflare Pages (or Vercel)
- [ ] Custom domain (`quickbugs.dev`)
- [ ] Beta banner in dashboard: "QuickBugs is in beta. All features are free."
- [ ] Announce: dev communities, X/Twitter, relevant subreddits

**Reference:** Dashboard views and SQL queries in [`SAAS_PLAN.md`](./SAAS_PLAN.md)

---

## Phase 4 — React Native SDK

> **Goal:** Ship `quick-bug-reporter-react-native` — shake-to-report with screenshot, video, annotation. CloudIntegration already works (built in Phase 2).

### 4.1 Core Capture

- [x] Shake detection (`react-native-shake` or accelerometer)
- [x] Screenshot capture (`react-native-view-shot`)
- [x] Screen recording (`react-native-nitro-screen-recorder`)
- [x] Device metadata collection (`react-native-device-info`)
- [x] `BugReporter` + `BugSession` adapted for RN

### 4.2 UI Components

- [x] Bottom sheet report form (`@gorhom/bottom-sheet`)
- [x] Screenshot annotator (`@shopify/react-native-skia`)
- [x] Floating action button
- [x] Recording indicator overlay

### 4.3 Integration

- [x] Add mobile columns to `report_events` migration (`platform`, `device_model`, `os_version`, `app_build`)
- [x] Update Edge Function to handle mobile-specific fields
- [x] CloudIntegration works identically (already in core)

### 4.4 Ship

- [ ] Expo dev client example app
- [x] README with setup guide
- [ ] Publish to npm

**Reference:** Full architecture and native module research in [`REACT_NATIVE_SDK.md`](./REACT_NATIVE_SDK.md)

---

## Phase 5 — Billing + Growth (post-beta)

### Billing (when beta ends)

- [ ] Stripe Checkout integration (Pro $29/mo, Team $79/mo)
- [ ] Plan enforcement in Edge Function (report count limits)
- [ ] Data retention cleanup via pg_cron (Free: 30d, Pro: 90d, Team: 365d)
- [ ] Pricing page update: "No seat pricing. No bandwidth surprises."

### Growth (ongoing)

- [ ] Team invites + role-based access
- [ ] Advanced analytics (trend comparisons, regression detection)
- [ ] Webhook/Slack notifications on new reports
- [ ] Custom ingestion domain (`ingest.quickbugs.dev`)
- [ ] Cloudflare Workers migration if Edge Function limits hit
- [ ] GitHub Actions: CI + automated npm publish workflows
- [ ] Self-hosted / on-premise option for enterprise
- [ ] Product Hunt + Hacker News launch (post-beta)

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| **SDK build** | pnpm workspaces + Turborepo + tsup |
| **Web SDK** | React 18+, Radix UI, Tailwind CSS v4, html2canvas-pro, MediaRecorder |
| **RN SDK** | React Native 0.72+, view-shot, Skia, bottom-sheet, nitro-recorder |
| **Backend** | Supabase (Postgres, Auth, Vault, Edge Functions) |
| **Dashboard** | Next.js on Cloudflare Pages |
| **Billing** | Stripe |
| **DNS/CDN** | Cloudflare (free) |

---

*Last updated: Feb 14, 2026*
