# QuickBugs — Business Strategy

_August 2026. Written against commit `8933175`._

## Summary

The roadmap describes a well-engineered path to a product that already has four
funded competitors and three open-source clones. Building it takes six months
and arrives at parity with Jam.dev's 2023 feature set.

The recommendation is to change the buyer rather than the build. QuickBugs is an
npm SDK that ships **inside** a customer's application. Jam is a browser
extension; Marker.io and BugHerd are widgets for staging sites. None of them can
capture a bug reported by *an end user in production*, because none of them are
installed in the product. QuickBugs can be.

That reframes the sale from "your QA team files better tickets" — a fight
against a funded incumbent — to "your customers can file reproducible bugs from
inside your app" — a category where the incumbent is a hand-rolled `<textarea>`
wired to Zendesk.

Price per report ingested, not per seat. Ship an agent-ready output. Sell to
20–30 accounts at $399/mo rather than 200 at $49.

---

## 1. Asset audit

**What exists and works**

- ~9,400 LOC of MIT-licensed TypeScript across four packages.
- A real capture engine: screenshot with region select and annotation, screen +
  mic recording, console capture, network logging, breadcrumbs, structured
  Steps/Expected/Actual fields, client metadata.
- Three shipped integrations: Jira (with correct ADF formatting), Linear
  (GraphQL), and a Cloud ingest adapter.
- Published to npm across React, Vue 3, and vanilla.
- Privacy primitives already scaffolded: mask/block selectors, log-key
  redaction, URL depth limiting, body capture off by default.

That is a genuine asset. The capture layer is the expensive part of this
product and it is largely done.

**What is broken**

- **The SDK is dormant.** Fourteen versions published between 11 and 17
  February 2026, then nothing for six months. Any developer who evaluates the
  package sees a February date on npm and closes the tab. This is the single
  most damaging fact about the project and it is also the cheapest to fix.
- **The capture engine is triplicated and has diverged.** `BugReporter.ts`,
  `ScreenRecorder.ts`, `BugSession.ts`, `ScreenshotCapturer.ts` and
  `WebMetadata.ts` exist as separate copies under `packages/react`,
  `packages/vue`, and `packages/vanilla`. The `ScreenRecorder` copies have three
  different checksums — they are no longer the same file. `packages/core`
  contains only integrations and loggers. Every capture fix now has to be made
  three times, and already isn't being.
- **Zero tests.** No unit, integration, or browser tests anywhere in the repo.
  The only CI workflow is publish-on-tag, which means npm publishes are
  unguarded by a single check.
- **Bundle weight for an embedded widget.** The React package pulls
  `radix-ui` (the meta-package), `lucide-react`, `html2canvas-pro`,
  `tailwind-merge`, and `class-variance-authority`. That is defensible for a
  dev-tool but heavy for something a customer ships to production users, which
  is exactly the positioning recommended below.
- **Package metadata points at a dead repo.** `quick-bug-reporter-react` lists
  `homepage`, `repository` and `bugs` as `AAALI/bug-reporter-react`, not
  `AAALI/Quickbugs`.

**Not assessed**

`QuickBugs/Platform` is a separate private repository and was not accessible
from this session; `quickbugs.com` was blocked by the network proxy. The
CHANGELOG references live `report_events` database columns, so a backend exists
in some form. Everything below assumes it is prototype-grade. If the hosted
ingest and inbox are further along than that, the 90-day plan compresses by
roughly three weeks.

---

## 2. Market read

| Product | Price | Form factor | Who reports the bug |
| --- | --- | --- | --- |
| Jam.dev | $14/creator/mo | Browser extension | Internal team only |
| Marker.io | $39–79/mo (console + network gated at $149) | Site widget | Team and review clients |
| BugHerd | $42–150/mo | Site widget | Team and review clients |
| Usersnap | $49–389/mo | Widget + surveys | Team and review clients |
| Crikket, FasterFixes, BugReel | Free / $20/mo | Self-hosted | Internal team |

Three conclusions follow.

**The internal-QA lane is closed.** Jam owns it, is well funded, and is free at
the bottom. A solo team does not win that fight by building the same product
more slowly.

**The "open-source Jam alternative" lane is also closed.** Crikket and
FasterFixes already occupy it and are further along on the hosted side.
Positioning QuickBugs there means competing on free against people who got
there first.

**The agency/client-feedback lane is crowded and low-margin.** Marker.io,
BugHerd, Usersnap and a dozen smaller tools fight over it. Margins are thin and
the buyer is a five-person agency.

There is one number in that table worth staring at. Marker.io gates console logs
and network capture — the two things that actually make a bug reproducible —
behind a $149/mo tier. QuickBugs captures both, today, in an MIT-licensed
package. That is a real pricing asymmetry, but only against the right buyer.

---

## 3. The wedge

**Sell in-app bug reporting to B2B SaaS product teams, priced per report.**

The distinguishing fact about QuickBugs is not its features — competitors have
the same features. It is the delivery mechanism. It is an npm package that
becomes part of the customer's application, which means:

- It works for **the customer's own end users**, who will never install a
  browser extension.
- It works in **production**, not just on a staging URL.
- It can be **white-labeled** — it renders inside their product, under their
  brand.

That describes a buyer with a different problem. A B2B SaaS company today gets
bug reports through Intercom or Zendesk that read "the export is broken." Their
support team spends a day going back and forth to establish a browser version.
Their alternative is to build an in-app reporter themselves, which is two to six
weeks of engineering nobody wants to own.

That is the sale: **a production-grade "Report a bug" button, in your product,
in an afternoon.**

Per-report pricing follows directly, and it is a counter-position rather than a
preference. Jam charges $14 per creator. If your reporters are your customers,
per-seat pricing is not expensive — it is structurally impossible. The more
people report bugs to you, the more Jam's model punishes you and the more
QuickBugs' model makes sense. Say this out loud on the pricing page.

**Second layer: make the output agent-ready.** Every bug that lands in a backlog
in 2026 gets pasted into Claude Code or Cursor. A QuickBugs report — structured
repro steps, console trace, network log, DOM context, release version — is
precisely the context an agent needs and precisely what a human-written ticket
lacks. Ship an MCP server and a "fix this with your agent" export.

Pie, Bugfender and bugAgent are already doing MCP, but all three come at it from
the observability side: logs and session data, expensive to collect and noisy to
search. QuickBugs starts from a human saying "this is broken, here," which is
cheaper to capture and higher signal. That is a better starting point for an
agent, and it is defensible.

---

## 4. Money

Open-core, with the licence boundary drawn at the server, not the SDK.

- **The MIT SDK stays MIT.** It is the distribution channel and the reason
  anyone finds this. Treat it as customer acquisition, not as a product.
- **Hosted ingest, inbox, and tracker delivery are paid.**
- **The self-hosted server is commercially licensed** (BSL or similar) — the SDK
  remains free, the backend does not.

**Proposed tiers**

| Tier | Price | Contents |
| --- | --- | --- |
| Open | Free | MIT SDK, bring your own backend, Jira/Linear via your own proxy |
| Starter | $99/mo | 500 reports/mo, hosted inbox, one tracker connection |
| Team | $399/mo | 5,000 reports, hosted Jira + Linear OAuth, MCP/agent export, 90-day retention |
| Self-hosted / in-region | from $1,500/mo | On-prem or regional deployment, unlimited reports, support SLA |

**What profitable means here.** For a one-person company operating through a
Dubai free-zone entity, roughly $8–10k MRR covers licensing, infrastructure, and
a real founder salary. Three ways to get there:

- 200 customers at $49 — reject this. It is the highest support burden and the
  lowest revenue per account, and it is the tier the roadmap's "define free and
  paid limits" line quietly implies.
- 25 customers at $399 — viable, and the spine of the plan.
- 5 customers at $1,500–2,000 self-hosted — fastest route to profitable, slowest
  to compound.

Price high and sell few. Do not build a self-serve $9 tier.

**One hypothesis worth testing early.** Gulf enterprises — banks, government,
healthcare — have hard data-residency requirements that a US SaaS cannot meet
without a regional deployment story. A Dubai-based vendor offering in-region or
on-prem bug reporting has a structural advantage over Jam.dev in that market
that has nothing to do with product quality. This is a hypothesis, not an
established fact, but it is cheap to test with three conversations and it is the
only genuinely defensible moat in this document.

---

## 5. Ninety days

The roadmap's sequencing is its main flaw: it places five releases of
engineering ahead of Release 6, "validate with design partners." Validation has
to come first, and it can be done with the code that already exists.

**Phase 1 — Weeks 1–2. Stop the bleeding.**

Non-negotiable, small, and blocking everything else.

- Collapse the triplicated capture engine into `@quick-bug-reporter/core`.
  React, Vue and vanilla become thin bindings. Reconcile the three diverged
  `ScreenRecorder` copies deliberately, not by picking one at random.
- Tests on the paths that break silently: console capture, network logging,
  redaction, metadata limits, payload shape for each integration.
- CI on every PR: install, typecheck, test, build. Publishing untested packages
  on a tag push is how you ship a broken capture engine to a paying customer.
- Fix the package metadata pointing at `bug-reporter-react`.
- **Ship a release.** Any release. Six months of silence on npm is read as
  abandonment, and the date on the package page is the first thing a technical
  buyer checks.

**Phase 2 — Weeks 1–4, in parallel. Sell before building.**

Ten conversations with product or engineering leads at B2B SaaS companies whose
users file bugs. Not "would you use this" — that question has no information in
it. The question is "here is a $99 invoice, I will install it with you on a
call."

Serve them concierge-style. They install the SDK, reports land in a Supabase
table, and you email or Slack the report to them by hand. No dashboard is needed
to prove the value, and building one first is how six months disappear.

Three paying design partners before writing platform code. If you cannot get
three, the positioning is wrong and finding that out in week four is worth more
than any feature.

**Phase 3 — Weeks 4–10. Build only what paying partners block on.**

Realistically this is hosted ingest plus an inbox plus Jira/Linear OAuth —
roadmap Releases 2 and 5. The onboarding polish and privacy UI of Releases 3 and
4 can wait until revenue exists, with one exception: default masking of
password, payment and auth fields should ship in Phase 1, because a single
credential leak into a bug report ends the company.

**Phase 4 — Weeks 8–12. Ship the differentiator.**

MCP server and agent export. This is the reason a buyer picks QuickBugs over
Marker.io, and it should be the headline on the site rather than a footnote.

---

## 6. Kill list

- **Vue and vanilla.** The roadmap already freezes them; go further and stop
  maintaining them. They are two thirds of the maintenance surface for
  approximately none of the revenue. Leave the published versions up, mark them
  community-maintained, and revisit only when a paying customer asks.
- **Open source as a goal in itself.** The MIT SDK is an acquisition channel.
  Stars are not revenue and community management is not a growth strategy at
  this stage.
- **The entire "After product validation" list.** The roadmap is right to defer
  it. Keep it deferred — particularly duplicate clustering and release
  analytics, which are large builds that no early customer will pay for.
- **A free self-serve tier with a dashboard.** Support burden with no revenue.
  The free tier is the SDK; free hosting is not a tier.

---

## 7. What would change this

Three things would materially revise the above:

1. **The Platform repo is further along than assumed.** If hosted ingest, auth
   and the inbox already work, skip Phase 2's concierge workaround and put
   design partners straight onto the real product.
2. **The in-app/end-user positioning does not land in the first ten
   conversations.** If prospects consistently say their end users do not report
   bugs, the fallback is the self-hosted, in-region enterprise play — fewer
   customers, higher prices, longer sales cycles, and profitable sooner.
3. **Jam or Marker ships an embeddable production SDK.** This is the main
   competitive risk and it is not far-fetched. The defence is the agent-ready
   output and the regional deployment story, not the capture engine, which is
   replicable.
