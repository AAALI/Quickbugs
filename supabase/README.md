# QuickBugs ingest — deployment

The reference deployment. It exists so a design partner can install the SDK and
have reports land somewhere real, before there is an inbox UI to look at them
in.

All the logic lives in [`packages/ingest`](../packages/ingest), which is runtime
agnostic and unit tested. What follows is the Supabase-specific wiring.

## What you get

- A `/ingest` endpoint the SDK's `CloudIntegration` posts to.
- Reports in Postgres, attachments in private storage.
- A webhook ping per report, so you can read and reply the same day.
- Idempotent submission: a retried upload returns the original report instead of
  duplicating it.

## Deploy

```bash
supabase db push
supabase functions deploy ingest --no-verify-jwt
```

`--no-verify-jwt` is required. Reports arrive from anonymous end users of the
customer's application; they are authenticated by the project key, not by a
Supabase JWT.

### Environment

Set on the function:

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | Provided by the platform |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Provided by the platform. Ingest bypasses RLS by design |
| `QUICKBUGS_APP_URL` | no | Base for report links, e.g. `https://app.quickbugs.com`. Omit and the API returns `url: null` |
| `QUICKBUGS_NOTIFY_WEBHOOK_URL` | no | Slack-compatible webhook pinged per report |

```bash
supabase secrets set QUICKBUGS_NOTIFY_WEBHOOK_URL="https://hooks.slack.com/services/…"
```

## Create a project

There is no dashboard yet, so insert the row directly. Keys follow
`pk_live_…` / `pk_test_…`; the environment is read from the key itself, so a
development install cannot write into production data by misconfiguration alone.

```sql
insert into public.projects (owner_id, name, project_key, allowed_origins)
values (
  auth.uid(),
  'Acme Checkout',
  'pk_live_' || encode(gen_random_bytes(12), 'hex'),
  array['https://app.acme.com', 'https://*.acme-staging.com']
)
returning project_key;
```

Leave `allowed_origins` empty to accept any origin. That is the right default
for a partner still wiring things up — refusing reports from someone who has not
found the setting yet loses data and teaches them nothing.

## Point the SDK at it

```tsx
import { CloudIntegration } from 'quick-bug-reporter-react'

const cloud = new CloudIntegration({
  projectKey: 'pk_live_…',
  ingestUrl: 'https://<project-ref>.supabase.co/functions/v1/ingest',
})
```

## Verify

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/ingest" \
  -F "project_key=pk_live_…" \
  -F "title=Test report from curl"
```

A `201` with `{"id": "...", "created_at": "...", "forwarding_status": "queued"}`
means the path works end to end.

## Reading reports during the concierge phase

```sql
select created_at, title, page_url, browser_name, reporter_email
from public.reports
where project_id = '…'
order by created_at desc
limit 20;
```

Attachments are in a private bucket. Generate a link when you need one:

```sql
select storage_path from public.report_attachments where report_id = '…';
```

```bash
supabase storage sign report-attachments/<path> --expires-in 3600
```

## Retention

`delete_expired_reports()` drops reports past their project's window.
Attachments follow by cascade. Schedule it once pg_cron is enabled:

```sql
select cron.schedule('quickbugs-retention', '0 3 * * *',
  $$select public.delete_expired_reports()$$);
```

Storage objects are not removed transactionally with the rows — Postgres cannot
do that against an object store. Pair this with a cleanup job that deletes
orphaned objects before promising customers a hard retention guarantee.

## Known gaps

Honest list of what this deployment does **not** do yet, so nobody promises it
to a customer:

- **No rate limiting.** A leaked project key can be used to flood a project.
  Origin allow-listing raises the bar but is forgeable.
- **No virus scanning** on uploaded attachments.
- **Storage objects outlive deleted reports** until the cleanup job above exists.
- **Single-owner projects.** No organizations, members, or roles — `owner_id`
  is one user. Multi-tenant access is Release 2 in the roadmap.
- **No tracker forwarding.** The API returns `forwarding_status: "queued"`
  because the SDK expects that shape; nothing consumes the queue yet.
