# @quick-bug-reporter/ingest

The server side of QuickBugs: the wire contract the SDK posts against, a parser,
and a runtime-agnostic request handler.

Storage is injected, so one implementation serves both QuickBugs Cloud and a
customer's self-hosted deployment. There is no second copy of the validation
rules to drift.

## Why this package exists separately

The SDK posts 45 text fields and 6 attachments. Before this package, nothing
verified that a server could actually parse them — the contract lived only in
the shape of the `FormData` the client happened to build.

`contract.ts` is now the single declaration of that shape, and a test in this
package drives the real `CloudIntegration` and parses whatever it actually
sends. Add a field to the SDK without declaring it here and the build fails
rather than the field silently vanishing from every report.

## Usage

```ts
import { createIngestHandler, type IngestStore } from '@quick-bug-reporter/ingest'

const store: IngestStore = {
  async findProjectByKey(projectKey) { /* … */ },
  async findReportByClientId(projectId, clientReportId) { /* … */ },
  async createReport(input) { /* … */ },
  async putAttachment(input) { /* … */ },
}

const handler = createIngestHandler({
  store,
  appBaseUrl: 'https://app.quickbugs.com',
  onReportCreated: (event) => notifySlack(event),
})

// Works anywhere the platform `Request`/`Response` types exist:
// Supabase Edge, Cloudflare Workers, Deno, Bun, Node 18+.
Deno.serve(handler)
```

A working Supabase implementation is in [`supabase/`](../../supabase).

## What the handler guarantees

**Idempotent submission.** The SDK stamps each capture with a `client_report_id`
at capture time, not at submit time. A submission that times out can be retried
with the same id and gets the original report back — the user never re-records.
The database's unique index is the real enforcement; the handler's
read-before-write only avoids a failed insert on the common path.

**Actionable errors.** Every rejection carries a stable `code`, an HTTP status,
and a `retryable` flag. Configuration and payload problems are permanent, so a
client that retries them forever is worse than one that gives up; only
infrastructure failures are marked retryable.

**No key-validity oracle.** An unknown key and a revoked key are rejected
identically.

**Attachments allow-listed by content type.** Anything accepted here is later
rendered in a browser, so the type list is a security boundary — a part with no
declared type is rejected rather than guessed at.

**Notification never costs a report.** Once a report is stored, a failing
webhook is swallowed. A broken Slack integration must not turn a stored report
into an error the client retries.

## Origin allow-listing is a spend control, not authentication

A project key ships inside the customer's browser bundle. It is public by
construction — anyone can read it out of the page. The origin allow-list stops a
scraped key being used to flood a project from somewhere else. A determined
attacker forges the header. Never describe it to a customer as authentication.

Two deliberate choices follow:

- An **empty** allow-list accepts everything. That is right for a project still
  being wired up; refusing reports from someone who has not found the setting
  yet loses data and teaches them nothing.
- A request with **no** `Origin` header is allowed. Server-to-server replays and
  some privacy tooling strip it, so blocking on absence costs real reports and
  buys nothing.

Wildcards match a single label: `https://*.example.com` admits
`https://app.example.com` but not `https://a.b.example.com`, because a customer
allow-listing their app subdomain rarely means to include every nested subdomain
a third party might control.

## Schema versioning

`SCHEMA_VERSION` is duplicated as `REPORT_SCHEMA_VERSION` in
`@quick-bug-reporter/core` so the browser bundle carries no server code. A
contract test fails if the two drift.

A server accepts any payload whose **major** version matches its own. A minor
bump means the client added an optional field the server can ignore, so
rejecting it would break older servers against newer SDKs for no benefit.
