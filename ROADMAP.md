# QuickBugs Product Roadmap

## Product goal

QuickBugs should turn an incomplete bug report into a reproducible engineering task. A customer should be able to create a project, install the React SDK, submit a report, and inspect that report in a hosted inbox in under five minutes.

The first release is successful when this complete path is reliable. Additional frameworks, AI features, and advanced analytics are secondary until that path is proven.

## Product principles

1. **Build the complete workflow before adding breadth.** Prioritize capture, ingestion, triage, and tracker delivery over additional SDKs.
2. **Make the safe path the default.** Mask sensitive fields, avoid collecting request bodies by default, and let reporters preview what will be sent.
3. **Own the difficult integration work.** Hosted Jira and Linear connections should not require customers to build proxy services.
4. **Prove value with evidence.** Measure successful reports and resolved bugs rather than SDK downloads alone.
5. **Keep one golden implementation.** React is the reference SDK until the shared core and cloud workflow are stable.

## Release 0: Align the product (week 1)

**Outcome:** the repository and public promise accurately describe one coherent product.

- [ ] Choose the canonical product and package naming under the QuickBugs brand.
- [ ] Correct package repository, homepage, issue tracker, and documentation links.
- [ ] Mark hosted features as available, beta, or planned; remove unsupported claims.
- [ ] Write the target user profile and primary use case: product teams shipping browser applications.
- [ ] Define the canonical report schema and API versioning policy.
- [ ] Document the system boundary between the browser SDK, ingest API, storage, dashboard, and tracker integrations.
- [ ] Freeze new Vue and vanilla features while the React golden path is built.

**Exit criteria**

- A developer can identify the correct package and current capabilities without ambiguity.
- Every advertised feature has a working path or an explicit beta/planned label.
- Product events and success metrics have agreed definitions.

## Release 1: Establish engineering safety (weeks 1–2)

**Outcome:** changes can ship without silently breaking capture or submission.

- [ ] Add linting and formatting checks to the root scripts.
- [ ] Add a unit-test runner and coverage reporting.
- [ ] Unit test console capture, network logging, breadcrumbs, metadata limits, formatting, and privacy redaction.
- [ ] Contract test Jira, Linear, and Cloud request payloads with mocked responses and failures.
- [ ] Add Playwright tests for screenshot capture, region selection, annotation, report submission, and cancellation.
- [ ] Add supported-browser coverage for current Chrome, Edge, Firefox, and Safari behavior where browser APIs differ.
- [ ] Add CI checks for install, typecheck, tests, build, package contents, and example applications.
- [ ] Add automated package-size budgets and resolve the current client-bundle warnings.

**Exit criteria**

- Every pull request runs repeatable unit, integration, browser, type, and build checks.
- Critical capture and submission paths have regression tests.
- Package artifacts are validated before publication.

## Release 2: Build the hosted core (weeks 2–5)

**Outcome:** QuickBugs Cloud is a real destination rather than only an SDK adapter.

### Accounts and projects

- [ ] Add authentication, password reset, and session management.
- [ ] Add organizations, members, roles, and projects.
- [ ] Issue rotatable, scoped project keys with separate development and production environments.
- [ ] Provide project settings for allowed origins, retention, capture limits, and privacy defaults.

### Ingestion

- [ ] Implement a versioned ingest endpoint for metadata and binary attachments.
- [ ] Validate project keys, origins, payload sizes, content types, and schema versions.
- [ ] Store report records and attachments with explicit retention and deletion behavior.
- [ ] Make report creation idempotent and add retry-safe client identifiers.
- [ ] Return actionable errors and a stable report URL.
- [ ] Add rate limiting, abuse protection, malware-aware file handling, and audit logs.
- [ ] Add structured logs, metrics, traces, and alerts for ingest failures and latency.

### Report inbox

- [ ] Build project report lists with status, assignee, environment, release, date, and search filters.
- [ ] Build report detail pages for video, screenshot, annotations, structured reproduction steps, errors, console output, network requests, breadcrumbs, user context, and device metadata.
- [ ] Add report status, assignment, comments, tags, internal links, and deletion.
- [ ] Add shareable links with access controls.
- [ ] Add loading, empty, expired-attachment, partial-upload, and error states.

**Exit criteria**

- A valid SDK report appears in the correct project inbox with all selected evidence.
- A user can triage, assign, comment on, and close a report.
- Operators can diagnose failed or delayed reports without database inspection.

## Release 3: Deliver a five-minute React onboarding (weeks 4–6)

**Outcome:** a new customer reaches a successful test report without assistance.

- [ ] Provide a project-creation wizard and framework-specific install snippet.
- [ ] Reduce the default React integration to a project key and provider/component setup.
- [ ] Add an in-dashboard “Send test report” verification flow.
- [ ] Add SDK initialization diagnostics for invalid keys, blocked origins, missing CSS, unsupported APIs, and failed uploads.
- [ ] Provide copyable examples for Vite, Next.js, Remix, and common CSP configurations.
- [ ] Build a polished demo application containing intentional, reproducible bugs.
- [ ] Publish a real documentation site with quick start, API reference, privacy guidance, troubleshooting, and migration notes.
- [ ] Add accessible keyboard behavior, focus management, reduced-motion support, and mobile layouts to the reporter UI.

**Exit criteria**

- Median time from signup to first hosted report is under five minutes.
- At least 80% of observed design-partner installs succeed without maintainer intervention.
- The reporter passes an accessibility audit for its primary workflow.

## Release 4: Make reports safe and dependable (weeks 5–7)

**Outcome:** teams can enable QuickBugs in production with informed privacy controls.

- [ ] Mask password, payment, authentication, and explicitly configured elements by default.
- [ ] Add a pre-submit evidence preview with per-section removal controls.
- [ ] Add URL, header, request-body, response-body, console, and custom-metadata redaction.
- [ ] Enforce client- and server-side recording duration and upload-size limits.
- [ ] Add cancellation, retry with backoff, upload progress, and partial-failure recovery.
- [ ] Document data collection, subprocessors, retention, deletion, and regional storage behavior.
- [ ] Add project-level data export and deletion controls.
- [ ] Complete a lightweight threat model and security review before public beta.

**Exit criteria**

- No known sensitive field is captured by the default configuration.
- A reporter can inspect and remove every evidence category before submission.
- Failed submissions are recoverable without repeating the capture when possible.

## Release 5: Own Jira and Linear delivery (weeks 6–8)

**Outcome:** customers connect their tracker without writing or hosting proxy endpoints.

- [ ] Add server-side OAuth connections for Jira and Linear.
- [ ] Add project/team, issue type, label, priority, and default-assignee mapping.
- [ ] Queue tracker delivery with retries, dead-letter handling, and visible sync state.
- [ ] Preserve the QuickBugs report as the source of rich evidence while creating a concise tracker issue.
- [ ] Sync tracker URL and selected status changes back to QuickBugs.
- [ ] Notify users when authentication expires or delivery fails.
- [ ] Keep self-hosted proxy support as an advanced option with deployable reference implementations.

**Exit criteria**

- An administrator can connect Jira or Linear through the dashboard.
- A submitted report creates the correctly mapped issue without customer backend code.
- Failed delivery is visible and can be retried safely.

## Release 6: Validate the product with design partners (weeks 8–10)

**Outcome:** real teams repeatedly use QuickBugs to resolve real defects.

- [ ] Recruit five design partners with active web products and direct access to their engineering teams.
- [ ] Observe onboarding rather than only collecting surveys.
- [ ] Review submitted reports weekly for completeness and usefulness.
- [ ] Track time to first report, capture success rate, ingest success rate, tracker delivery success, report-to-fix conversion, and time to resolution.
- [ ] Interview reporters and developers separately about friction and missing evidence.
- [ ] Fix the three largest workflow failures before expanding scope.
- [ ] Define free and paid limits only after observing storage and usage patterns.

**Beta launch gates**

- At least 95% of initiated submissions reach the inbox successfully.
- At least 95% of connected tracker deliveries succeed without manual retry.
- At least 60% of submitted reports are judged actionable by the receiving developers.
- At least three design partners use the product in consecutive weeks.
- There are no unresolved critical privacy or data-loss issues.

## After product validation

Build these only after the beta gates are met:

- [ ] GitHub Issues and Slack integrations.
- [ ] Source-map ingestion and readable stack traces.
- [ ] Duplicate detection and clustering.
- [ ] AI-assisted titles and summaries with clear controls and fallbacks.
- [ ] Release health and regression analytics.
- [ ] Vue and vanilla parity based on demonstrated customer demand.
- [ ] Team analytics, SSO, audit exports, and enterprise retention policies.

## Explicitly deferred

- Native mobile SDKs.
- A broad session-replay platform.
- General-purpose observability or application-performance monitoring.
- More frontend framework packages before React is stable.
- AI features that do not measurably improve report actionability.
- Complex billing optimization before consistent weekly usage exists.

## Workstream ownership

| Workstream | Primary responsibility | First deliverable |
| --- | --- | --- |
| Product | Scope, interviews, metrics, launch gates | Golden-path specification |
| SDK | Capture reliability, privacy, browser support | Tested React integration |
| Platform | Auth, projects, ingestion, storage | Durable report creation API |
| Web product | Onboarding, inbox, report detail | End-to-end hosted workflow |
| Integrations | Jira/Linear auth, mapping, delivery | Hosted Linear connection |
| Reliability/security | CI, observability, abuse controls, threat model | Release checklist and dashboards |

## Definition of the first sellable release

QuickBugs is sellable when a customer can independently:

1. Sign up and create a project.
2. Install the React SDK with a project key.
3. Configure privacy defaults and send a test report.
4. Submit a real report containing useful reproduction evidence.
5. Find and triage that report in the hosted inbox.
6. Deliver it to Jira or Linear without customer backend code.
7. Recover from common configuration and upload failures.
8. Understand what data is collected, how long it is retained, and how to delete it.

Until all eight steps work reliably, the priority is completing the product loop—not adding feature breadth.
