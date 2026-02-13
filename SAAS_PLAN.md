# SaaS Conversion Plan — `quick-bug-reporter-react`

> **Design philosophy:** Pass-through proxy with lightweight analytics. Bug reports go straight to Jira/Linear — we don't store media. But we **do** log metadata per report (browser, OS, app version, capture mode) to power a Sentry-style dashboard. **Two services: Supabase + Cloudflare. $0/month.**

---

## Architecture — Supabase + Cloudflare

```
┌──────────────────────────────────────────────────────┐
│                    SUPABASE (free)                    │
│                                                      │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────┐ │
│  │ Edge Function │  │  Postgres  │  │  Supabase    │ │
│  │ (ingestion   │  │  - projects │  │  Auth        │ │
│  │  proxy)      │──│  - creds   │  │  (dashboard  │ │
│  │              │  │  - report  │  │   users)     │ │
│  │              │  │    events  │  │              │ │
│  └──────┬───────┘  └─────┬──────┘  └──────────────┘ │
│         │                │                           │
│         │          ┌─────┴──────┐                    │
│         │          │   Vault    │                    │
│         │          │ (encrypted │                    │
│         │          │  API keys) │                    │
│         │          └────────────┘                    │
└─────────┼────────────────────────────────────────────┘
          │ forwards bug report (media + issue creation)
          ▼
   ┌──────────────┐
   │  Jira/Linear │  ← customer's tracker stores the actual content
   └──────────────┘

┌──────────────────────────────────────┐
│         CLOUDFLARE (free)            │
│  ┌────────────────────────────────┐  │
│  │  Cloudflare Pages              │  │
│  │  Next.js Dashboard + Analytics │  │
│  └────────────────────────────────┘  │
│  DNS (free) │ CDN (free) │ DDoS      │
└──────────────────────────────────────┘
```

**Total services: 2** — Supabase (data layer) + Cloudflare (frontend + CDN). Both free tier.

### Why this split?

| Service | Role | Why |
|---------|------|-----|
| **Supabase** | DB + Auth + Vault + Edge Functions | Best all-in-one backend. One project replaces 6 services. |
| **Cloudflare Pages** | Dashboard hosting | **Unlimited bandwidth** (Vercel caps at 100GB). Global CDN. Free custom domains. |
| **Cloudflare DNS** | Domain + DDoS | Free. Protects both the dashboard and the ingestion endpoint. |

---

## What We Store vs What We Don't

| Data | Store? | Why |
|------|:---:|-----|
| Bug report title | **Yes** | Analytics: recent reports list |
| Screenshot/video files | **No** | Forwarded directly to Jira/Linear |
| Network/console logs | **No** | Forwarded as attachments to Jira/Linear |
| Browser + version | **Yes** | "45% of bugs from Chrome 120" |
| OS + version | **Yes** | "macOS 14 has 3x more bugs" |
| App version (release) | **Yes** | "v1.2.3 introduced a regression" |
| Capture mode | **Yes** | "70% screenshot, 30% video" |
| Page URL | **Yes** | "Most bugs from /checkout" |
| Screen resolution | **Yes** | "Mobile users report 2x more bugs" |
| Environment | **Yes** | Filter: only production bugs |
| External issue link | **Yes** | Click-through to Jira/Linear |
| Submission status | **Yes** | Monitor proxy health |
| Jira/Linear API keys | **Yes** (Vault) | Encrypted at rest, required for proxy |

**Key:** We store **metadata** (~500 bytes/row) but **not content** (screenshots, videos, logs).

---

## The Complete Flow

```
1. User clicks "Submit Bug" in their app
2. SDK sends multipart POST to Supabase Edge Function
   - Header: X-Project-Key: qbr_proj_xxxxx
   - Body: title, description, screenshot, video, logs, metadata
3. Edge Function:
   a. Validates project key → looks up project + integration
   b. Checks rate limit → counts recent report_events
   c. Decrypts credentials from Vault
   d. Forwards to Jira/Linear API (create issue + upload attachments)
   e. Logs a report_event with metadata (for analytics)
   f. Returns { issueId, issueKey, issueUrl } to SDK
4. SDK shows success. Media lives in Jira/Linear. Metadata in our DB.
```

---

## Report Events — Sentry-Style Analytics

The `report_events` table logs metadata after each proxy forward. Fields are extracted from the SDK's existing `BugReportPayload` and `BugClientMetadata` types — no new data collection.

The SDK already captures (via `collectClientEnvironmentMetadata()`): platform, viewport, screen size, device info, connection type, color scheme, locale, timezone. Plus `captureMode`, `pageUrl`, `userAgent` from the payload.

Two new **optional** SDK fields for richer analytics:

```tsx
<BugReporterProvider
  projectKey="qbr_proj_xxxxx"
  appVersion="1.2.3"          // Sentry's "release" — track regressions
  environment="production"     // prod | staging | dev
/>
```

Browser/OS are parsed server-side from `userAgent` in the Edge Function.

---

## Dashboard Analytics Views

All powered by simple SQL aggregations on `report_events`:

- **Bug count over time** — line chart, reports per day/week/month
- **Capture mode breakdown** — pie chart, screenshot vs video ratio
- **Browser breakdown** — bar chart, Chrome 65% / Firefox 20% / Safari 15%
- **OS breakdown** — bar chart, macOS / Windows / Linux
- **App versions impacted** — table: version, bug count, first seen, last seen
- **Top pages** — table: page_url ranked by report count
- **Device type split** — bar chart: desktop / mobile / tablet
- **Environment filter** — toggle: production / staging / all
- **Recent reports** — table: title, browser, page, timestamp, ↗ Jira/Linear link
- **Success rate** — percentage of reports successfully forwarded
- **Screen resolutions** — grouped by most common

Example query — versions impacted:
```sql
SELECT app_version, count(*) AS bugs,
  min(created_at) AS first_seen, max(created_at) AS last_seen
FROM report_events WHERE project_id = $1
GROUP BY app_version ORDER BY bugs DESC;
```

---

## Data Model

Five tables. Metadata per report — no content stored.

```sql
-- 1. Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Members (links Supabase Auth users → orgs)
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  UNIQUE(org_id, user_id)
);

-- 3. Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  project_key TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  rate_limit_per_min INT DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Integrations (secrets in Vault)
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  vault_secret_id UUID NOT NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, provider)
);

-- 5. Report events (analytics + billing + rate limiting)
CREATE TABLE report_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  -- Report info
  title TEXT NOT NULL,
  provider TEXT NOT NULL,               -- 'jira' | 'linear'
  capture_mode TEXT NOT NULL,           -- 'screenshot' | 'video'
  has_screenshot BOOLEAN DEFAULT false,
  has_video BOOLEAN DEFAULT false,
  has_network_logs BOOLEAN DEFAULT false,
  has_console_logs BOOLEAN DEFAULT false,
  js_error_count INT DEFAULT 0,
  -- External tracker reference
  external_issue_id TEXT,
  external_issue_key TEXT,              -- "BUG-42"
  external_issue_url TEXT,
  -- Client environment (parsed from userAgent + BugClientMetadata)
  user_agent TEXT,
  browser_name TEXT,
  browser_version TEXT,
  os_name TEXT,
  os_version TEXT,
  device_type TEXT,                     -- 'desktop' | 'mobile' | 'tablet'
  screen_resolution TEXT,               -- "1920x1080"
  viewport TEXT,                        -- "1440x900"
  color_scheme TEXT,
  locale TEXT,
  timezone TEXT,
  connection_type TEXT,                 -- "4g" | "wifi"
  page_url TEXT,
  -- App context (Sentry-style)
  app_version TEXT,                     -- "1.2.3"
  environment TEXT,                     -- "production" | "staging"
  -- Status
  status TEXT DEFAULT 'success',
  error_message TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_projects_key ON projects(project_key);
CREATE INDEX idx_events_project_time ON report_events(project_id, created_at);
CREATE INDEX idx_events_project_version ON report_events(project_id, app_version);
CREATE INDEX idx_events_project_browser ON report_events(project_id, browser_name);
CREATE INDEX idx_events_project_status ON report_events(project_id, status);
```

### Storage estimate

Each row ~500-800 bytes. At 10K reports/month = ~8MB/month. 500MB free Postgres holds 5+ years.

### Data retention (cleanup via pg_cron)

- Free plan: 30 days
- Pro: 90 days
- Team/Enterprise: 365 days

---

## Security — Supabase Vault

**Supabase Vault** (`pgsodium`) — authenticated encryption at rest. No custom code.

```sql
-- Store encrypted
SELECT vault.create_secret(
  '{"apiToken":"xoxb-...","baseUrl":"https://co.atlassian.net","email":"dev@co.com"}',
  'jira-creds-project-abc123',
  'Jira credentials for project abc123'
);

-- Decrypt at runtime (service_role only — Edge Function)
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = $1;
```

### RLS Policies

```sql
CREATE POLICY "org_access" ON projects FOR ALL
  USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "org_integrations" ON integrations FOR ALL
  USING (project_id IN (
    SELECT id FROM projects WHERE org_id IN (
      SELECT org_id FROM members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "org_events" ON report_events FOR SELECT
  USING (project_id IN (
    SELECT id FROM projects WHERE org_id IN (
      SELECT org_id FROM members WHERE user_id = auth.uid()
    )
  ));
```

---

## Rate Limiting Without Redis

The `report_events` table doubles as the rate limiter:

```sql
SELECT count(*) FROM report_events
WHERE project_id = $1 AND created_at > now() - interval '1 minute';
```

With `idx_events_project_time`, this is <1ms. Cloudflare DNS provides DDoS protection on top.

---

## Free Tier Limits

### Supabase Free

| Resource | Limit | Our Usage (early) |
|----------|:---:|:---:|
| **Database** | 500 MB | <10 MB |
| **Auth users** | 50,000 MAU | <100 |
| **Edge Function invocations** | 500,000/month | <5,000 |
| **Edge Function memory** | 256 MB | ~20-80 MB |
| **Edge Function timeout** | 150 seconds | ~5-15s |
| **Edge Function body size** | ~100 MB | <50 MB |
| **Bandwidth** | 5 GB | <1 GB |
| **Vault** | Included | A few secrets per project |

### Cloudflare Pages Free

| Resource | Limit |
|----------|:---:|
| **Bandwidth** | **Unlimited** |
| **Static asset requests** | **Unlimited** |
| **Builds** | 500/month |
| **Concurrent builds** | 1 |
| **Custom domains** | Unlimited |
| **Pages Functions** | 100,000 requests/day |

**Cloudflare Pages vs Vercel**: Cloudflare has **unlimited bandwidth** (Vercel soft caps at 100GB). No surprise bills.

---

## Total Cost Breakdown

### At Launch — $0/month

| Service | What | Cost |
|---------|------|:---:|
| **Supabase** | DB + Auth + Vault + Edge Functions | **$0** |
| **Cloudflare Pages** | Dashboard hosting (unlimited BW) | **$0** |
| **Cloudflare DNS** | Domain DNS + CDN + DDoS | **$0** |
| **Stripe** | Billing (per-transaction only) | **$0 base** |
| **Domain** | quickbugreporter.com | **~$10/year** |
| **TOTAL** | | **~$1/month** |

### Growing (50-500 customers, ~5K reports/month) — still $0

Same stack. 5K reports = 1% of Supabase free Edge Function limit (500K).

### At Scale (500+ customers, 50K+ reports/month) — $25/month

Upgrade to Supabase Pro ($25/mo): 8GB DB, 2M invocations, 250GB BW, daily backups.

### Compared to alternatives

| | VPS (Hetzner+Coolify) | **Supabase + Cloudflare** |
|-|:---:|:---:|
| **Services** | 5+ | **2** |
| **Cost at launch** | ~$5/mo | **$0/mo** |
| **Ops** | VPS patches, Docker, backups | **None** |
| **Bandwidth** | Capped | **Unlimited** (Cloudflare) |
| **Scaling** | Manual | **Automatic** |

---

## Pricing Strategy

| Plan | Price | Reports/mo | Projects | Analytics Retention |
|------|:---:|:---:|:---:|:---:|
| **Free** | $0 | 50 | 1 | 30 days |
| **Pro** | $29 | 1,000 | 5 | 90 days |
| **Team** | $79 | 5,000 | Unlimited | 365 days |
| **Enterprise** | Custom | Unlimited | Unlimited | Custom |

Usage tracked via `report_events` count. Stripe metered billing.

---

## SDK Changes

```ts
// src/integrations/cloud.ts — NEW
export class CloudIntegration implements BugReporterIntegration {
  readonly provider = "cloud" as const;
  private projectKey: string;
  private ingestUrl: string;
  private appVersion?: string;
  private environment?: string;

  constructor(options: {
    projectKey: string;
    ingestUrl?: string;
    appVersion?: string;
    environment?: string;
  }) {
    this.projectKey = options.projectKey;
    this.ingestUrl = options.ingestUrl ?? "https://<ref>.supabase.co/functions/v1";
    this.appVersion = options.appVersion;
    this.environment = options.environment;
  }

  async submit(payload: BugReportPayload, onProgress?: SubmitProgressCallback): Promise<BugSubmitResult> {
    const progress = onProgress ?? (() => {});

    progress("Sending report…");
    const formData = new FormData();
    formData.set("title", payload.title);
    formData.set("description", payload.description);
    formData.set("captureMode", payload.captureMode);
    formData.set("pageUrl", payload.pageUrl);
    formData.set("userAgent", payload.userAgent);
    formData.set("metadata", JSON.stringify(payload.metadata));
    if (this.appVersion) formData.set("appVersion", this.appVersion);
    if (this.environment) formData.set("environment", this.environment);

    if (payload.screenshotBlob) formData.append("screenshot", payload.screenshotBlob, "screenshot.png");
    if (payload.videoBlob) formData.append("video", payload.videoBlob, "recording.webm");

    formData.append("networkLogs",
      new Blob([formatNetworkLogs(payload.networkLogs)], { type: "text/plain" }), "network-logs.txt");
    formData.append("clientMetadata",
      new Blob([JSON.stringify(payload.metadata, null, 2)], { type: "application/json" }), "client-metadata.json");

    if (payload.consoleLogs.length > 0 || payload.jsErrors.length > 0) {
      const parts: string[] = [];
      if (payload.jsErrors.length > 0) parts.push(formatJsErrors(payload.jsErrors));
      if (payload.consoleLogs.length > 0) parts.push(formatConsoleLogs(payload.consoleLogs));
      formData.append("consoleLogs",
        new Blob([parts.join("\n\n")], { type: "text/plain" }), "console-logs.txt");
    }
    formData.set("jsErrorCount", String(payload.jsErrors.length));

    progress("Submitting…");
    const res = await fetch(`${this.ingestUrl}/ingest`, {
      method: "POST",
      headers: { "X-Project-Key": this.projectKey },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Submission failed" }));
      throw new Error(body.error || `Submission failed (${res.status})`);
    }

    const result = await res.json();
    progress("Done!");
    return {
      provider: result.provider,
      issueId: result.issueId,
      issueKey: result.issueKey,
      issueUrl: result.issueUrl,
      warnings: result.warnings ?? [],
    };
  }
}
```

---

## Repo Structure

```
bug-reporter-saas/
├── packages/
│   └── react/                       # npm package + CloudIntegration
│       ├── src/
│       │   ├── core/
│       │   ├── integrations/
│       │   │   ├── linear.ts        # unchanged
│       │   │   ├── jira.ts          # unchanged
│       │   │   └── cloud.ts         # NEW
│       │   └── ui/
│       └── package.json
│
├── apps/
│   └── dashboard/                   # Next.js on Cloudflare Pages
│       ├── app/
│       │   ├── (auth)/login/
│       │   ├── (dashboard)/
│       │   │   ├── page.tsx         # projects overview + sparklines
│       │   │   ├── projects/[id]/
│       │   │   │   ├── page.tsx     # project settings
│       │   │   │   ├── analytics/   # Sentry-style analytics
│       │   │   │   ├── reports/     # recent reports table
│       │   │   │   └── integrations/
│       │   │   └── settings/
│       │   └── layout.tsx
│       ├── lib/supabase.ts
│       ├── components/ui/           # shadcn/ui
│       └── package.json
│
├── supabase/
│   ├── functions/
│   │   └── ingest/index.ts          # Edge Function proxy
│   ├── migrations/
│   │   └── 001_initial_schema.sql   # 5 tables + RLS + Vault
│   └── config.toml
│
├── pnpm-workspace.yaml
└── .env.example
```

---

## Migration Path

### Phase 1 — Foundation (1-2 weeks)

- [ ] Create Supabase project
- [ ] Run migration (5 tables + RLS + Vault)
- [ ] Build `ingest` Edge Function with UA parsing + analytics logging
- [ ] Add `CloudIntegration` to npm package
- [ ] Test end-to-end: SDK → Edge Function → Jira/Linear → report_events logged
- [ ] Deploy via `supabase functions deploy`

### Phase 2 — Dashboard MVP (2 weeks)

- [ ] Scaffold Next.js app with Supabase Auth
- [ ] Project CRUD + key generation
- [ ] Integration config (Jira/Linear credential forms → Vault)
- [ ] **Analytics page** (bug count chart, browser/OS/version breakdowns)
- [ ] Recent reports table with external links
- [ ] Deploy to **Cloudflare Pages** (`npx wrangler pages deploy`)

### Phase 3 — Billing + Launch (1 week)

- [ ] Stripe Checkout for Pro/Team plans
- [ ] Plan enforcement in Edge Function
- [ ] Data retention cleanup (pg_cron per plan tier)
- [ ] Landing page
- [ ] Launch on Product Hunt / HN / X

### Phase 4 — Growth (ongoing)

- [ ] Team invites + roles
- [ ] Advanced analytics (trends, regressions, comparisons)
- [ ] Webhook notifications on new reports
- [ ] Custom ingestion domain (ingest.quickbugreporter.com)
- [ ] Cloudflare Workers migration if Edge Function limits hit

---

## Scaling Path

| Stage | Reports/mo | Action | Cost |
|-------|:---:|--------|:---:|
| **Launch** | <500 | Supabase Free + Cloudflare Free | $0/mo |
| **Traction** | 500-50K | Same stack, within free limits | $0/mo |
| **Growth** | 50K-500K | Supabase Pro ($25) | $25/mo |
| **Scale** | 500K+ | + Cloudflare Workers ($5) for edge proxy | $30/mo |
| **Enterprise** | 1M+ | Dedicated infra, self-hosted option | Revenue covers it |

Costs grow **after** revenue. Never pay ahead of demand.

---

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| **Store report content?** | **No** — media forwarded to Jira/Linear | Zero storage cost, no GDPR burden |
| **Store report metadata?** | **Yes** — `report_events` table | Powers Sentry-style analytics dashboard |
| **Backend** | **Supabase** | Auth + DB + Vault + Edge Functions. One service. |
| **Frontend hosting** | **Cloudflare Pages** | Unlimited bandwidth (Vercel caps at 100GB). Free custom domains. |
| **DNS + CDN** | **Cloudflare** (free) | DDoS protection, global CDN, free SSL |
| **Credential encryption** | **Supabase Vault** | Encrypted at rest, decryptable only server-side |
| **Rate limiting** | **Postgres** (no Redis) | `count(*)` on `report_events` with index |
| **Billing** | **Stripe** (metered) | Per-transaction pricing |
| **Total services** | **2** (Supabase + Cloudflare) | Minimal ops, minimal cost |
| **Cost at launch** | **$0/month** | Domain only (~$10/year) |

---

## Why This Works

The existing npm package already has proxy patterns (`submitProxyEndpoint`, split proxy endpoints). The SaaS is a hosted version of those proxies, wrapped in project key auth + credential decryption + lightweight analytics logging.

**What changed from v1 of this plan:** We now store ~500 bytes of metadata per report (browser, OS, version, capture mode, page URL, etc.) — this powers dashboard analytics without storing any actual content. Cloudflare Pages replaces Vercel for unlimited bandwidth.

---

## Appendix: Why Supabase Over Convex?

Convex is excellent for real-time collaborative apps (Figma, Notion-style). We evaluated Convex + Cloudflare as an alternative stack. Here's why Supabase wins for **our** use case (proxy + analytics dashboard):

### Head-to-head

| Requirement | Supabase | Convex | Winner |
|-------------|----------|--------|:------:|
| **Encrypted credential storage** | **Vault** (pgsodium) — per-customer secrets in DB | Env vars only (per-deployment). No Vault. Need custom crypto. | Supabase |
| **HTTP body size** | **~100MB** Edge Function | **20MB** HTTP action limit | Supabase |
| **SQL analytics** | Native `GROUP BY`, `count(*)`, `date_trunc` | Document model, no SQL. Manual aggregation. | Supabase |
| **Auth (free)** | **50K MAU**, email + OAuth, built-in | Newer Convex Auth, or Clerk ($25/mo at scale) | Supabase |
| **Free function calls** | 500K/month | **1M/month** | Convex |
| **Paid pricing** | **$25/mo flat** per org | **$25/member/mo** (3 devs = $75) | Supabase |
| **Realtime reactivity** | Channels (add-on) | **Built-in** reactive queries | Convex |
| **TypeScript DX** | Good (generated types) | **Excellent** (tRPC-style e2e) | Convex |
| **RLS** | **Built-in** Postgres policies | Manual auth checks per function | Supabase |
| **Cloudflare Pages** | Works (JS client) | Works (official guide) | Tie |

### Three deal-breakers for Convex

1. **No Vault** — We store hundreds of customers' Jira/Linear API keys. Supabase Vault encrypts each at rest, decryptable only server-side. Convex would require custom AES-256 encryption code — the exact complexity we eliminated.

2. **20MB HTTP action limit** — Bug reports include video recordings up to ~50MB. Supabase handles ~100MB. Convex would need a 2-step upload URL workaround, adding SDK complexity.

3. **No SQL for analytics** — All 11 dashboard views are simple `SELECT ... GROUP BY` queries. Convex has no `GROUP BY`, `count(*)`, or `date_trunc`. We'd need pre-computed counters or manual iteration.

### Where Convex wins (but we don't need)

- **Realtime**: Best-in-class reactive queries. Our dashboard loads on page visit — no live updates needed.
- **TypeScript DX**: End-to-end type safety. Supabase's generated types are sufficient for us.
- **1M free calls**: 2x Supabase, but both exceed our early needs.

**Verdict: Supabase + Cloudflare is the right stack for a proxy + analytics SaaS.**
