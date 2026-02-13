# Project Plan — QuickBugs 🐞

> **Priority order:** Landing page + auth + onboarding → Edge Function + CloudIntegration → Dashboard + beta launch → React Native SDK → Billing + growth.
>
> Brand reference: [`Brand_Guid.md`](./Brand_Guid.md) · User journey: [`USER_JOURNEY.md`](./USER_JOURNEY.md)

---

## Status Overview

| Phase | Status | ETA |
|-------|:------:|:---:|
| **0 — Monorepo Setup** | ✅ Complete | Done |
| **1 — Supabase + Landing + Auth + Onboarding** | 🔲 Next up | 2 weeks |
| **2 — Edge Function + CloudIntegration** | 🔲 Queued | 1-2 weeks |
| **3 — Dashboard + Beta Launch** | 🔲 Queued | 2 weeks |
| **4 — React Native SDK** | 🔲 Queued | 2-3 weeks |
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

## Phase 1 — Supabase + Landing + Auth + Onboarding

> **Goal:** Public-facing site + sign-up + onboarding wizard. User goes from landing page to "waiting for first bug report" screen. Supabase schema is deployed because auth and onboarding both need the database.

### 1.1 Supabase Setup

- [ ] Create Supabase project
- [ ] Run initial migration: 5 tables (`organizations`, `members`, `projects`, `integrations`, `report_events`)
- [ ] Configure RLS policies (org-scoped access)
- [ ] Set up Vault for encrypted credential storage
- [ ] Configure Auth providers (magic link email, GitHub OAuth, Google OAuth)

### 1.2 App Scaffold

- [ ] Create `apps/dashboard/` — Next.js app (landing + dashboard in one)
- [ ] Add to `pnpm-workspace.yaml`
- [ ] shadcn/ui + Tailwind CSS setup (colors from Brand Guide: `#0F172A`, `#14B8A6`, `#22D3EE`, `#F8FAFC`)
- [ ] Light-first design. No gradients. Supabase × Linear × Vercel feel.

### 1.3 Landing Page

- [ ] Hero: "Forward bugs to Jira or Linear. See patterns. Ship faster."
- [ ] How it works section (4 steps)
- [ ] No media storage differentiator section
- [ ] Analytics preview section (realistic examples, not placeholder)
- [ ] Encrypted credentials / security section
- [ ] Pricing section: "Free during beta. No credit card required."
- [ ] CTAs: "Start Free", "View Docs"
- [ ] All copy aligned with [`Brand_Guid.md`](./Brand_Guid.md)

### 1.4 Auth (Magic Link)

- [ ] Sign up page — email + GitHub OAuth + Google OAuth
- [ ] Supabase Auth: `signInWithOtp` (magic link) + `signInWithOAuth`
- [ ] "Check your email" confirmation screen
- [ ] Auth callback handler (`/auth/callback`)
- [ ] Route guard: new users → onboarding, returning users → dashboard

### 1.5 Onboarding Wizard (5 steps)

- [ ] **Step 1:** Create organization (name + slug)
- [ ] **Step 2:** Create project (name + platform select: React / React Native coming soon)
- [ ] **Step 3:** Connect tracker (Jira or Linear credentials → Vault, "Test Connection" button, skip option)
- [ ] **Step 4:** Install SDK (pre-filled code snippets with project key, copy-to-clipboard)
- [ ] **Step 5:** Verify — "Waiting for first bug report" polling screen (wired up in Phase 2)
- [ ] Success screen: show first report details + link to tracker + "Go to Dashboard"
- [ ] Onboarding state tracking (`signed_up` → `org_created` → `project_created` → `integration_set` → `sdk_verified`)
- [ ] Progress indicator (step N of 5)

**Reference:** Full screen wireframes and flow in [`USER_JOURNEY.md`](./USER_JOURNEY.md)

---

## Phase 2 — Edge Function + CloudIntegration

> **Goal:** Complete the backend. SDK can submit bug reports through the Supabase Edge Function proxy. Onboarding verify step works end-to-end.

### 2.1 Ingest Edge Function

- [ ] Create `supabase/functions/ingest/index.ts`
- [ ] Validate `X-Project-Key` header → look up project + integration
- [ ] Rate limiting via `report_events` count
- [ ] Decrypt credentials from Vault
- [ ] Forward bug report to Jira/Linear API (create issue + upload attachments)
- [ ] Parse `User-Agent` for browser/OS fields
- [ ] Log `report_event` row (metadata only, no media stored)
- [ ] Return `{ issueId, issueKey, issueUrl }` to SDK

### 2.2 CloudIntegration (SDK)

- [ ] Create `packages/core/src/integrations/cloud.ts` — `CloudIntegration` class
- [ ] Accepts `projectKey`, `ingestUrl`, `appVersion`, `environment`
- [ ] Sends multipart POST to Edge Function with all report data
- [ ] Re-export from `packages/core/src/index.ts` and both SDK barrels
- [ ] Update `BugReporterIntegrations` type to include `cloud` provider

### 2.3 Wire Up Verify + Test Connection

- [ ] Onboarding Step 5 polling → checks `report_events` for first report
- [ ] "Test Connection" button in onboarding Step 3 → dry-run credential verification
- [ ] End-to-end test: SDK → Edge Function → Jira issue created → `report_events` row logged
- [ ] Deploy: `supabase functions deploy ingest`

**Reference:** Full architecture, data model, and security details in [`SAAS_PLAN.md`](./SAAS_PLAN.md)

---

## Phase 3 — Dashboard + Beta Launch

> **Goal:** Analytics dashboard, project management, and public beta launch. Free for all users during beta.

### 3.1 Dashboard Layout

- [ ] Sidebar navigation (Overview, Reports, Analytics, Integrations, Settings)
- [ ] Project switcher in header
- [ ] Empty state for projects with no reports

### 3.2 Project Management

- [ ] Organization + project CRUD
- [ ] Project key display + rotation
- [ ] Integration config (edit Jira/Linear credentials, test connection)
- [ ] Project settings (rate limit, active/inactive toggle)

### 3.3 Analytics Dashboard

- [ ] **Bug count over time** — line chart (reports per day/week/month)
- [ ] **Browser breakdown** — bar chart
- [ ] **OS breakdown** — bar chart
- [ ] **App versions impacted** — table with bug count, first/last seen
- [ ] **Top pages** — table ranked by report count
- [ ] **Device type split** — desktop / mobile / tablet
- [ ] **Capture mode breakdown** — screenshot vs video ratio
- [ ] **Recent reports** — table with title, browser, page, timestamp, ↗ Jira/Linear link
- [ ] **Success rate** — percentage of reports forwarded
- [ ] Environment filter toggle (production / staging / all)

### 3.4 Deploy + Beta Launch

- [ ] Deploy to Cloudflare Pages
- [ ] Custom domain (`quickbugs.dev`)
- [ ] Beta banner in dashboard: "QuickBugs is in beta. All features are free."
- [ ] Announce: dev communities, X/Twitter, relevant subreddits

**Reference:** Dashboard views and SQL queries in [`SAAS_PLAN.md`](./SAAS_PLAN.md)

---

## Phase 4 — React Native SDK

> **Goal:** Ship `quick-bug-reporter-react-native` — shake-to-report with screenshot, video, annotation. CloudIntegration already works (built in Phase 2).

### 4.1 Core Capture

- [ ] Shake detection (`react-native-shake` or accelerometer)
- [ ] Screenshot capture (`react-native-view-shot`)
- [ ] Screen recording (`react-native-nitro-screen-recorder`)
- [ ] Device metadata collection (`react-native-device-info`)
- [ ] `BugReporter` + `BugSession` adapted for RN

### 4.2 UI Components

- [ ] Bottom sheet report form (`@gorhom/bottom-sheet`)
- [ ] Screenshot annotator (`@shopify/react-native-skia`)
- [ ] Floating action button
- [ ] Recording indicator overlay

### 4.3 Integration

- [ ] Add mobile columns to `report_events` migration (`platform`, `device_model`, `os_version`, `app_build`)
- [ ] Update Edge Function to handle mobile-specific fields
- [ ] CloudIntegration works identically (already in core)

### 4.4 Ship

- [ ] Expo dev client example app
- [ ] README with setup guide
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

*Last updated: Feb 13, 2026*
