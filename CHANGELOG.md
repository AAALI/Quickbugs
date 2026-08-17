# Changelog

## [Unreleased] — SDK 1.6.0 / core 1.3.0

First release since February 2026. Consolidates the capture engine, makes
privacy defaults unconditional, and puts every change behind CI.

### Privacy — safe by default

Previously nothing was masked unless the integrator configured it, and captured
URLs were never redacted at all.

- Passwords, one-time codes, and payment fields are now blurred in screenshots
  with **no configuration required** (`DEFAULT_MASK_SELECTORS`).
- Credential-bearing query parameters and URL fragments are stripped from
  network logs, the reported page URL, and tracker issue descriptions. OAuth
  implicit-flow tokens in `#access_token=` are covered.
- `data-quickbugs-mask` blurs an element; `data-quickbugs-block` replaces it.
- The default body-redaction key list grew from three entries to eighteen.
- Auth endpoints skipped for body capture now include `/signin`, `/session`,
  and `/oauth`.
- Redaction no longer mutates the caller's request body.

**Behaviour change:** `redactBodyKeys` and `privacy.redactLogKeys` now *add* to
the built-in defaults instead of replacing them, so a partial configuration can
no longer widen what is captured. Pass `privacy.disableDefaultMasking: true` to
opt out entirely — documented as unsafe.

### Capture engine consolidated

`BugReporter`, `BugSession`, `ScreenRecorder`, `ScreenshotCapturer`, and
`WebMetadata` existed as three separate copies under the React, Vue, and vanilla
packages, and had diverged — the three `ScreenRecorder` files were no longer the
same code, and the vanilla copy had lost error mapping entirely, surfacing raw
`NotAllowedError` instead of "Screen or microphone permission was denied."

All three copies are replaced by one implementation in
`@quick-bug-reporter/core`. The framework packages are now thin bindings that
re-export it. **No public API changed** — every previously exported name is
still exported from the same package.

- `html2canvas-pro` moved from the three binding packages to `core`.

### Packaging fixes

- `quick-bug-reporter`: the `./cdn` export pointed at `dist/quickbugs.iife.js`,
  but the build emitted `dist/quickbugs.iife.iife.js`. The CDN entry point did
  not resolve in any published version.
- `quick-bug-reporter-vue`: removed the `./styles.css` export, which pointed at
  a file the build never produced. The Vue components style inline and need no
  stylesheet.
- `quick-bug-reporter-react`: `repository`, `homepage`, and `bugs` pointed at
  `AAALI/bug-reporter-react`, which does not exist. All four packages now point
  at `AAALI/Quickbugs`.

### Engineering safety

- Added a test suite: 92 tests covering privacy defaults and redaction, network
  and console capture, session lifecycle, screenshot masking, and the request
  payloads for Cloud, Jira, and Linear.
- Added CI on every pull request: typecheck, test with coverage, build, and
  packaging verification.
- `pnpm verify:packaging` packs each package and fails if a declared entry point
  is missing from the tarball. This is what caught the two packaging bugs above.
- Publishing on a tag now runs the same gate. Previously a tag push published to
  npm with no checks at all.

## [1.5.0] - 2026-02-16

### Added - Structured Bug Report Fields

**Major UX Enhancement:** The bug report form now uses a tab-based interface for structured bug details instead of a single description field.

#### User-Facing Changes
- **Tab-based UI** with 4 sections:
  - **Steps to Reproduce** - Auto-numbered list (press Enter to increment)
  - **Expected Result** - What should happen
  - **Actual Result** - What actually happened
  - **Additional Context** - Extra notes, workarounds, etc.
- All fields are **optional** with a **4000 character combined limit**
- Live character counter with visual feedback when over limit
- Auto-numbering in Steps tab: Start typing and press Enter to automatically add "1.", "2.", "3.", etc.

#### Backend Changes
- **New database columns** in `report_events`:
  - `steps_to_reproduce` (TEXT)
  - `expected_result` (TEXT)
  - `actual_result` (TEXT)
  - `additional_context` (TEXT)
- **Backward compatibility**: `description` field maintained as concatenated version for legacy support
- **Enhanced tracker formatting**:
  - Jira: Uses proper ADF (Atlassian Document Format) with bold headers via `marks: [{ type: "strong" }]`
  - Linear: Uses H3 markdown headers (`### Steps to Reproduce`)

#### Developer Changes
- Updated `BugReportPayload` type with new optional fields
- Modified `CloudIntegration` to serialize structured fields via FormData
- Updated `/api/ingest` route to parse and store structured fields
- Enhanced `toJiraAdf()` to properly handle bold headers with ADF marks
- Updated `buildJiraDescription()` and `buildLinearDescription()` to prioritize structured fields

#### Migration Notes
- **Database migration**: `20260216000000_add_structured_fields.sql` adds 4 new nullable columns
- **No breaking changes**: Old SDK versions continue working with the `description` field
- **No action required**: Existing bug reports remain unchanged (read-only fields)

---

## [1.5.1] - 2026-02-17

### Added - 7-Day File Retention Policy

**Storage Optimization:** Implemented automatic cleanup of old attachments to minimize storage costs.

#### Changes
- **Database function** `delete_old_report_attachments()` for cleaning up files older than 7 days
- **Edge Function** `cleanup-old-attachments` runs daily at 2 AM UTC via cron
- **Migration**: `20260217173047_add_storage_lifecycle_policy.sql` adds cleanup function
- **Files forwarded immediately** to Jira/Linear on report submission
- **7-day buffer** retained for failed forwarding retries and manual recovery
- **Documentation updated** in `AGENT_GUIDE.md` and function README

#### Why 7 Days?
- Files are already stored permanently in Jira/Linear
- Supabase copies serve as temporary backup only
- Keeps storage costs minimal while maintaining safety buffer

---

## Previous Releases

See git history for earlier versions.
