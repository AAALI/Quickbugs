# QuickBugs — End-to-End User Journey

> Brand reference: [`Brand_Guid.md`](./Brand_Guid.md)
> Technical reference: [`SAAS_PLAN.md`](./SAAS_PLAN.md)

---

## Journey Overview

```
Landing Page → Sign Up (magic link) → Onboarding Wizard → Dashboard → First Bug Report
```

Six screens from visitor to value. No credit card. No password.

---

## 1. Landing Page

**URL:** `quickbugs.dev` (or `quickbugreporter.com`)

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  🐞 QuickBugs                        [View Docs] [Login]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Forward bugs to Jira or Linear.                        │
│  See patterns. Ship faster.                             │
│                                                         │
│  QuickBugs captures issues with screenshots or video,   │
│  forwards them directly to your tracker, and logs       │
│  lightweight metadata for release analytics.            │
│                                                         │
│  [Start Free]     [View Docs]                           │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  HOW IT WORKS                                           │
│  1. User submits a bug                                  │
│  2. QuickBugs forwards it to Jira or Linear             │
│  3. Metadata is logged (browser, OS, version, page)     │
│  4. Dashboard surfaces patterns                         │
│                                                         │
│  No duplicate storage. No new issue tracker.            │
├─────────────────────────────────────────────────────────┤
│  NO MEDIA STORAGE                                       │
│  Screenshots and videos go directly to Jira or Linear.  │
│  QuickBugs stores only metadata.                        │
├─────────────────────────────────────────────────────────┤
│  SPOT REGRESSIONS EARLY                                 │
│  v1.2.4 — 18 reports                                    │
│  Chrome 121 — 63%                                       │
│  /checkout — 12 reports                                 │
├─────────────────────────────────────────────────────────┤
│  ENCRYPTED CREDENTIALS                                  │
│  Supabase Vault · Row-level security                    │
│  Project-scoped API keys · No plaintext secrets         │
├─────────────────────────────────────────────────────────┤
│  PRICING                                                │
│  Free during beta. No credit card required.             │
│  [Start Free]                                           │
├─────────────────────────────────────────────────────────┤
│  Footer: docs · github · status                         │
└─────────────────────────────────────────────────────────┘
```

### Copy rules (from Brand Guide)
- No exclamation marks
- CTA buttons: "Start Free", "View Docs", "Login"
- Colors: Primary Dark `#0F172A`, Accent Teal `#14B8A6`, Background `#F8FAFC`
- Design feel: Supabase × Linear × Vercel
- Light-first. No gradients. No heavy shadows.

---

## 2. Sign Up — Magic Link

**Trigger:** User clicks "Start Free" on landing page.

### Screen: `/signup`

```
┌─────────────────────────────────────────────┐
│                                             │
│  🐞 QuickBugs                               │
│                                             │
│  Create your account                        │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Email address                        │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  [Continue with Email]                      │
│                                             │
│  ── or ──                                   │
│                                             │
│  [Continue with GitHub]                     │
│  [Continue with Google]                     │
│                                             │
│  Already have an account? Log in            │
│                                             │
└─────────────────────────────────────────────┘
```

### Auth flow

| Method | Implementation |
|--------|---------------|
| **Magic link** (primary) | Supabase Auth `signInWithOtp({ email })` — no password |
| **GitHub OAuth** | Supabase Auth `signInWithOAuth({ provider: 'github' })` |
| **Google OAuth** | Supabase Auth `signInWithOAuth({ provider: 'google' })` |

### Screen: `/signup/check-email`

```
┌─────────────────────────────────────────────┐
│                                             │
│  Check your email                           │
│                                             │
│  We sent a login link to dev@company.com    │
│                                             │
│  Click the link to continue.                │
│  The link expires in 10 minutes.            │
│                                             │
│  [Resend link]                              │
│                                             │
└─────────────────────────────────────────────┘
```

**After click:** User lands on `/onboarding/org` (new users) or `/dashboard` (returning users).

### Implementation notes

- Supabase handles magic link delivery via built-in email templates
- Customize email template with QuickBugs branding (logo, colors, minimal copy)
- Redirect URL: `https://quickbugs.dev/auth/callback`
- Auth callback exchanges code for session, checks if user has an org → route accordingly

---

## 3. Onboarding Wizard

Multi-step wizard. Inspired by Sentry's project creation + PostHog's product selection flow.

**Key design principles** (learned from PostHog/Sentry research):
- Show progress indicator (step N of M)
- Each step has one clear action
- Code snippets are copy-to-clipboard
- "Waiting for first event" polling screen builds confidence
- Skip options where reasonable (e.g. integration can be added later)

### Step 1: Create Organization — `/onboarding/org`

First-time users only. Returning users skip to dashboard.

```
┌─────────────────────────────────────────────┐
│                                             │
│  Step 1 of 5                                │
│  ●───○───○───○───○                          │
│                                             │
│  Name your organization                     │
│                                             │
│  This is your team workspace.               │
│  You can invite members later.              │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Organization name                    │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  [Continue]                                 │
│                                             │
└─────────────────────────────────────────────┘
```

**Backend:**
- `INSERT INTO organizations (name, slug, plan)` with `plan = 'beta'`
- `INSERT INTO members (org_id, user_id, role)` with `role = 'owner'`

---

### Step 2: Create Project — `/onboarding/project`

```
┌─────────────────────────────────────────────┐
│                                             │
│  Step 2 of 5                                │
│  ●───●───○───○───○                          │
│                                             │
│  Create your first project                  │
│                                             │
│  A project maps to one app or environment.  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Project name                         │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Platform:                                  │
│  ┌─────────────┐  ┌─────────────────────┐   │
│  │ ⚛ React     │  │ 📱 React Native     │   │
│  │  (selected) │  │    (coming soon)    │   │
│  └─────────────┘  └─────────────────────┘   │
│                                             │
│  [Continue]                                 │
│                                             │
└─────────────────────────────────────────────┘
```

**Backend:**
- `INSERT INTO projects (org_id, name, project_key, platform)`
- Generate `project_key`: `qbr_proj_` + 20 random alphanumeric chars
- Platform stored for tailored SDK instructions

---

### Step 3: Connect Tracker — `/onboarding/integration`

```
┌─────────────────────────────────────────────┐
│                                             │
│  Step 3 of 5                                │
│  ●───●───●───○───○                          │
│                                             │
│  Connect your issue tracker                 │
│                                             │
│  Bug reports are forwarded directly.        │
│  QuickBugs does not store media.            │
│                                             │
│  ┌─────────────┐  ┌─────────────┐           │
│  │  ◇ Linear   │  │  ◆ Jira     │           │
│  └─────────────┘  └─────────────┘           │
│                                             │
│  ── Jira Configuration ──                   │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Jira base URL                        │  │
│  │  e.g. https://company.atlassian.net   │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │  Email address                        │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │  API token                            │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │  Project key (e.g. BUG)               │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  🔒 Credentials are encrypted with          │
│     Supabase Vault. Never stored as         │
│     plaintext.                              │
│                                             │
│  [Test Connection]    [Continue]             │
│                                             │
│  Skip — I'll configure this later           │
│                                             │
└─────────────────────────────────────────────┘
```

**Linear alternative fields:**
- API key
- Team ID
- Project ID (optional)

**Backend:**
- `vault.create_secret(credentials_json, label)` → returns `vault_secret_id`
- `INSERT INTO integrations (project_id, provider, vault_secret_id, config)`
- "Test Connection" calls Edge Function with a dry-run flag to verify credentials

**Tooltip for API token field:**
> "This key authenticates your SDK with the ingestion endpoint."

---

### Step 4: Install SDK — `/onboarding/install`

The core activation step. Modeled after Sentry's "add to your app" wizard.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Step 4 of 5                                            │
│  ●───●───●───●───○                                      │
│                                                         │
│  Add QuickBugs to your app                              │
│                                                         │
│  1. Install the SDK                                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │  npm install quick-bug-reporter-react         [📋]│    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  2. Add the provider to your app root                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │  import {                                     [📋]│    │
│  │    BugReporterProvider,                           │    │
│  │    FloatingBugButton,                             │    │
│  │    BugReporterModal,                              │    │
│  │    CloudIntegration,                              │    │
│  │  } from "quick-bug-reporter-react";               │    │
│  │  import "quick-bug-reporter-react/styles.css";    │    │
│  │                                                   │    │
│  │  const cloud = new CloudIntegration({             │    │
│  │    projectKey: "qbr_proj_a1b2c3d4e5f6g7h8i9j0",  │    │
│  │  });                                              │    │
│  │                                                   │    │
│  │  function App({ children }) {                     │    │
│  │    return (                                       │    │
│  │      <BugReporterProvider                         │    │
│  │        integrations={{ cloud }}                    │    │
│  │        defaultProvider="cloud"                     │    │
│  │        appVersion="1.0.0"                         │    │
│  │        environment="production"                    │    │
│  │      >                                            │    │
│  │        {children}                                 │    │
│  │        <FloatingBugButton />                      │    │
│  │        <BugReporterModal />                       │    │
│  │      </BugReporterProvider>                       │    │
│  │    );                                             │    │
│  │  }                                                │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Your project key is pre-filled above.                  │
│  The floating button renders at the bottom-right        │
│  corner of your app.                                    │
│                                                         │
│  [I've added the code — verify setup]                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key UX details:**
- Project key is pre-filled from Step 2 (no copy-paste errors)
- Code snippets have one-click copy buttons
- Snippet adapts to selected platform (React vs React Native in future)
- Optional `appVersion` and `environment` shown with inline tooltip

---

### Step 5: Verify — Waiting for First Report — `/onboarding/verify`

Inspired by Sentry's "Waiting for first event" screen. Polls the backend for the first `report_event` row matching this project.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Step 5 of 5                                            │
│  ●───●───●───●───●                                      │
│                                                         │
│  Waiting for your first bug report                      │
│                                                         │
│         ┌─────────────────────┐                         │
│         │                     │                         │
│         │    🐞  ← ·····      │  ← animated dots        │
│         │                     │                         │
│         └─────────────────────┘                         │
│                                                         │
│  Submit a test bug report from your app.                │
│  This page updates automatically.                       │
│                                                         │
│  Checklist:                                             │
│  ☐ SDK installed                                        │
│  ☐ Provider wrapped around your app                     │
│  ☐ Click the floating bug button in your app            │
│  ☐ Fill in a title and submit                           │
│                                                         │
│  [Skip — go to dashboard]                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**When first report arrives:**

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ●───●───●───●───●                                      │
│                                                         │
│  Your first bug report was received                     │
│                                                         │
│         ┌─────────────────────┐                         │
│         │                     │                         │
│         │       🐞 ✓          │                         │
│         │                     │                         │
│         └─────────────────────┘                         │
│                                                         │
│  "Login button misaligned on mobile"                    │
│  Chrome 121 · macOS 14.3 · /login                       │
│  Forwarded to Jira → BUG-42                             │
│                                                         │
│  [View in Jira ↗]     [Go to Dashboard]                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Implementation:**
- Poll `GET /functions/v1/project-status?key=qbr_proj_xxx` every 3 seconds
- Edge Function returns `{ hasReports: boolean, latestReport?: { title, browser, os, page, externalUrl } }`
- Use Supabase Realtime as an upgrade path (subscribe to `report_events` inserts)
- Timeout after 5 minutes: show "No report yet. You can verify later from the dashboard."

---

## 4. Dashboard — First Session

**URL:** `/dashboard` → redirects to `/projects/{id}`

### Empty state (before first report)

```
┌────────────────────────────────────────────────────────────────────┐
│  🐞 QuickBugs    [Projects ▾]    [Docs]    [Settings]    [user ▾] │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  My App                                          Project key: [📋] │
│  qbr_proj_a1b2c3d4e5f6g7h8i9j0                                    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │  No bug reports yet.                                         │  │
│  │                                                              │  │
│  │  Submit your first report from your app,                     │  │
│  │  or check the setup guide.                                   │  │
│  │                                                              │  │
│  │  [View Setup Guide]                                          │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Active state (after reports arrive)

```
┌────────────────────────────────────────────────────────────────────┐
│  🐞 QuickBugs    [Projects ▾]    [Docs]    [Settings]    [user ▾] │
├─────────┬──────────────────────────────────────────────────────────┤
│         │                                                          │
│ Overview│  My App — Last 7 days                                    │
│ Reports │                                                          │
│Analytics│  ┌─ Bug Reports ───────────────────────────────────────┐ │
│ Integr. │  │  ▁▂▃▅▃▂▁▃▅▇▅▃▂   42 total  · 6/day avg           │ │
│Settings │  └────────────────────────────────────────────────────┘ │
│         │                                                          │
│         │  ┌─ Browser ──────┐  ┌─ OS ──────────────┐              │
│         │  │ Chrome    63%  │  │ macOS 14     45%  │              │
│         │  │ Firefox   22%  │  │ Windows 11   38%  │              │
│         │  │ Safari    15%  │  │ Linux        17%  │              │
│         │  └────────────────┘  └────────────────────┘              │
│         │                                                          │
│         │  ┌─ Top Pages ──────────────┐                            │
│         │  │ /checkout      12 reports │                            │
│         │  │ /login          8 reports │                            │
│         │  │ /dashboard      6 reports │                            │
│         │  └──────────────────────────┘                            │
│         │                                                          │
│         │  ┌─ Recent Reports ─────────────────────────────────┐    │
│         │  │ "Login button misaligned"  Chrome · /login  ↗Jira│    │
│         │  │ "Checkout crashes on iOS"  Safari · /checkout ↗LN│    │
│         │  │ "Dark mode text unreadable" FF · /settings  ↗Jira│    │
│         │  └──────────────────────────────────────────────────┘    │
│         │                                                          │
└─────────┴──────────────────────────────────────────────────────────┘
```

### Dashboard pages

| Route | Content |
|-------|---------|
| `/projects/{id}` | Overview: sparkline, key stats, recent reports |
| `/projects/{id}/reports` | Full reports table with filters (browser, OS, version, page) |
| `/projects/{id}/analytics` | Charts: bug count over time, browser/OS/version breakdowns, top pages, device types, capture mode, success rate |
| `/projects/{id}/integrations` | Jira/Linear config, test connection, credential management |
| `/projects/{id}/settings` | Project name, key rotation, rate limit, environment filter |
| `/settings` | Org settings, members (future), account, logout |

---

## 5. Returning User Flow

```
quickbugs.dev/login
       │
       ▼
  ┌──────────┐     magic link      ┌───────────┐
  │  Email    │ ──────────────────► │  Inbox    │
  │  form     │                     │  click    │
  └──────────┘                     └─────┬─────┘
                                         │
                                         ▼
                                   /auth/callback
                                         │
                              ┌──────────┴──────────┐
                              │ Has org + project?   │
                              └──────────┬──────────┘
                                    yes  │  no
                              ┌──────────┴──────────┐
                              ▼                     ▼
                         /dashboard          /onboarding/org
```

---

## 6. State Machine — Onboarding Completion

Track onboarding progress in a `user_metadata` JSONB column (Supabase Auth) or a separate `onboarding_state` table.

```
States:
  signed_up        → user created, no org
  org_created      → org exists, no project
  project_created  → project exists, no integration
  integration_set  → integration configured, no SDK verified
  sdk_verified     → first report received (onboarding complete)
```

**Usage:**
- Route guard checks state → redirects to correct onboarding step
- Dashboard shows "Setup incomplete" banner until `sdk_verified`
- PostHog-style: if user hasn't reached `sdk_verified` after 24h, send a help email

---

## 7. Email Touchpoints

Minimal. Functional. No marketing fluff.

| Trigger | Email | Content |
|---------|-------|---------|
| Sign up | Welcome | "Your QuickBugs account is ready. Log in to create your first project." |
| 24h, no project | Nudge | "You signed up but haven't created a project yet. It takes 2 minutes." |
| 48h, no first report | Help | "Your project is set up but we haven't received a report. Check the setup guide." |
| First report received | Confirmation | "Your first bug report was forwarded to {Jira/Linear}. View it in your dashboard." |

**Tone:** Calm, direct. From a real email address (e.g. `ali@quickbugs.dev`). No exclamation marks.

---

## 8. Error States

All error copy follows Brand Guide — direct and clear.

| Scenario | Message |
|----------|---------|
| Invalid email | "Enter a valid email address." |
| Magic link expired | "This link has expired. Request a new one." |
| Duplicate org slug | "This name is taken. Choose another." |
| Invalid Jira credentials | "Could not connect to Jira. Check your base URL and API token." |
| Invalid Linear API key | "Invalid API key. Generate one at linear.app/settings/api." |
| Rate limit on verify | "Rate limit exceeded. Wait a moment and try again." |
| No report after 5min | "No report received yet. You can verify later from the dashboard." |

---

## 9. Tech Implementation Summary

| Component | Technology |
|-----------|-----------|
| **Landing page** | Next.js static pages on Cloudflare Pages |
| **Auth** | Supabase Auth (magic link + OAuth) |
| **Onboarding state** | Supabase `auth.users.user_metadata` JSONB |
| **Dashboard** | Next.js app routes with Supabase client |
| **Onboarding wizard** | Client-side multi-step form (React state) |
| **Verify polling** | `setInterval` polling Edge Function (upgrade to Realtime later) |
| **Email** | Supabase Auth emails (magic link) + custom SMTP for nudges |
| **UI framework** | shadcn/ui + Tailwind CSS |
| **Charts** | Recharts or Tremor |

---

## 10. Screen Inventory

Full list of screens to build:

### Public (unauthenticated)
1. `/` — Landing page
2. `/login` — Email + OAuth sign-in
3. `/signup` — Email + OAuth sign-up
4. `/signup/check-email` — Magic link sent confirmation
5. `/auth/callback` — Auth redirect handler

### Onboarding (authenticated, incomplete setup)
6. `/onboarding/org` — Create organization
7. `/onboarding/project` — Create project + select platform
8. `/onboarding/integration` — Connect Jira or Linear
9. `/onboarding/install` — SDK install instructions
10. `/onboarding/verify` — Waiting for first report

### Dashboard (authenticated, setup complete)
11. `/dashboard` — Projects list (redirects to first project if only one)
12. `/projects/{id}` — Project overview
13. `/projects/{id}/reports` — Reports table
14. `/projects/{id}/analytics` — Charts and breakdowns
15. `/projects/{id}/integrations` — Tracker config
16. `/projects/{id}/settings` — Project settings
17. `/settings` — Org + account settings

**Total: 17 screens.**

---

*Tone and copy aligned with [`Brand_Guid.md`](./Brand_Guid.md). All UI text follows the "calm, precise, minimal" voice.*
