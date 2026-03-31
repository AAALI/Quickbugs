# QuickBugs SDK — Product Requirements Document

**Version:** 1.0 · March 2026 · Internal  
**Repo:** `quickbugs/sdk` (public, MIT)  
**Author:** Ali Abdulkadir Ali · SIRO & CO FZCO  
**Companion doc:** QuickBugs Platform PRD (private repo)

> This document covers everything in the open source SDK: what data gets captured, how it is structured, and what improvements are needed. The SDK's job is to collect the richest possible context from inside the running app and forward it to the QuickBugs ingest endpoint. It never stores data. It never shows UI beyond the bug reporter widget.

---

## What the SDK does today

The SDK captures and forwards a structured `BugReportPayload` containing:

### Visual evidence
- **Screenshot** — DOM snapshot via `html2canvas-pro` with 3-tier fallback (foreignObject → DOM clone → sanitized clone). Region selection and highlight annotation supported. Annotations stored as normalised (0..1) coordinates.
- **Screen recording** — WebM VP9 via `getDisplayMedia` + `getUserMedia`. Display audio and mic mixed via `AudioContext`. Up to 2 minutes configurable.

### Logs
- **Console logs** — monkey-patched `console.log/info/warn/error`. Last 200 entries. Captures from `BugReporterProvider` mount onward.
- **JS errors** — `window.onerror` + `unhandledrejection`. Last 50 entries with message, source, line number, stack trace.
- **Network requests** — monkey-patched `globalThis.fetch` only. Method, URL, status, duration, timestamp. No request/response bodies.

### Structured report fields
- Title (required)
- Steps to reproduce (optional)
- Expected result (optional)
- Actual result (optional)
- Additional context (optional)

### Client metadata (BugClientMetadata — 50+ fields)
- Locale, timezone, language
- Viewport (width, height, pixel ratio)
- Screen (dimensions, colour depth)
- Device (hardware concurrency, device memory GB, max touch points, online, cookie enabled)
- Network (effective type, downlink Mbps, RTT ms, save data)
- Colour scheme (light/dark)
- Platform, referrer
- Capture timing (started, stopped, elapsed)
- Annotation data (highlight regions)

### Developer-configurable fields
- `projectKey` — required
- `appVersion` — optional, enables release analytics
- `environment` — optional (`development`/`staging`/`production`)
- `endpoint` — optional, defaults to `https://quickbugs.com/api/ingest`

---

## What is missing from the SDK (gaps to fix)

These are the additions that make QuickBugs genuinely more powerful than Jam.dev. Every item here captures data that a browser extension fundamentally cannot reach — because it requires being inside the running app.

---

### SDK-01 — Make microphone optional

**Priority:** P0 — blocking users today  
**File:** `packages/react/src/core/ScreenRecorder.ts`

**Problem:** Recording fails entirely if `getUserMedia` (mic) is denied. Corporate browsers, kiosk mode, and users who decline mic access cannot record at all.

**Change:**
- Wrap `getUserMedia` in `try/catch`
- On failure: continue with screen-only using the `getDisplayMedia` audio track
- If no display audio: record video-only (silent)
- Add `capture_has_mic: boolean` to recording metadata
- Never surface a recording error to the user because of mic
- Log mic failure at `console.warn` level only

**Acceptance:** Denying mic permission allows recording to continue. Valid `.webm` is produced.

---

### SDK-02 — XHR interception in NetworkLogger

**Priority:** P1  
**File:** `packages/core/src/logging/NetworkLogger.ts`

**Problem:** Only `fetch` is intercepted. Apps using Axios (default XHR config), jQuery AJAX, or legacy `XMLHttpRequest` code produce no network logs. Silent blind spot.

**Change:**
- Intercept `XMLHttpRequest.prototype.open` and `XMLHttpRequest.prototype.send`
- Capture method, URL, status, duration using same `NetworkLogEntry` type as fetch
- Restore originals on `stop()`

**Acceptance:** An Axios request appears in network logs. A `fetch` request still appears. Stopping `NetworkLogger` restores both prototypes.

---

### SDK-03 — User identity

**Priority:** P0  
**Files:** `packages/core/src/types.ts`, `packages/react/src/ui/BugReporterProvider.tsx`, `packages/core/src/integrations/cloud.ts`

**Problem:** Every report is anonymous. Cannot identify who reported a bug or correlate bugs to users.

**Add `UserIdentity` type:**
```typescript
export interface UserIdentity {
  id?: string
  email?: string
  name?: string
}
```

**Add optional `user` prop to `BugReporterProvider`:**
```tsx
<BugReporterProvider
  integrations={{ cloud }}
  user={{
    id: auth.currentUser?.id,
    email: auth.currentUser?.email,
    name: auth.currentUser?.displayName,
  }}
>
```

**`CloudIntegration` change:** Include `user_id`, `user_email`, `user_name` in FormData when provided.

**Rules:**
- All fields optional. Never require identity to submit a report.
- Zero breaking changes to existing consumers.

---

### SDK-04 — Request/response body capture (opt-in)

**Priority:** P1  
**File:** `packages/core/src/logging/NetworkLogger.ts`

**Problem:** Network logs currently show `GET /api/checkout → 500 (240ms)` but not the error response body. This is the most common thing a developer needs to debug a failing API call.

**Add opt-in body capture to `CloudIntegration`:**
```typescript
const cloud = new CloudIntegration({
  projectKey: 'qb_live_xxx',
  captureRequestBodies: false,   // default: false
  captureResponseBodies: true,   // default: false
  maxBodySize: 10_000,           // bytes, default: 10KB
  redactBodyKeys: ['password', 'token', 'authorization'], // default list
})
```

**Capture in `NetworkLogger`:**
- When `captureRequestBodies: true`: capture request body for POST/PUT/PATCH. Truncate at `maxBodySize`.
- When `captureResponseBodies: true`: capture response body text. Truncate at `maxBodySize`.
- Apply `redactBodyKeys` — replace matching keys in JSON bodies with `"[REDACTED]"` before storing.
- Never capture bodies for requests to known auth endpoints (containing `/auth/`, `/login`, `/token`).

**`NetworkLogEntry` type additions:**
```typescript
interface NetworkLogEntry {
  method: string
  url: string
  status: number
  durationMs: number
  timestamp: string
  // new fields:
  requestBody?: string  // truncated, redacted
  responseBody?: string // truncated, redacted
  requestHeaders?: Record<string, string> // opt-in, redacted
}
```

---

### SDK-05 — Custom metadata hooks

**Priority:** P1  
**Files:** `packages/core/src/types.ts`, `packages/core/src/integrations/cloud.ts`

**Problem:** The SDK captures browser/device context but knows nothing about the app's business state — which user is logged in, what plan they are on, what feature flags are active, which A/B test variant they are seeing.

**Add `metadata` option to `CloudIntegration`:**
```typescript
const cloud = new CloudIntegration({
  projectKey: 'qb_live_xxx',
  metadata: {
    // Functions called at report-submit time, not at init time
    userId:      () => auth.currentUser?.id,
    userPlan:    () => account.plan,
    featureFlag: () => flags.newCheckout,
    abVariant:   () => experiment.variant,
    orgId:       () => workspace.id,
  }
})
```

**Rules:**
- Values are functions (called lazily at submit time, not at init)
- Each function must return `string | number | boolean | null`
- Results serialised to JSON and sent as `custom_metadata` field in FormData
- Maximum 20 keys, maximum 500 bytes total when serialised
- If a function throws: skip that key, log `console.warn`, continue

**Why functions not values:** App state at init time (when the provider mounts) is often not the same as state at report time (when the user submits a bug). User may not be authenticated yet at mount.

---

### SDK-06 — Event timeline / breadcrumbs

**Priority:** P2  
**Files:** `packages/core/src/logging/BreadcrumbCapture.ts` (new), `packages/react/src/ui/BugReporterProvider.tsx`

**Problem:** The SDK captures a snapshot of state at the moment of submission but no history of what the user did before the bug occurred. "The checkout button stopped working" is much harder to debug than "user clicked Product → Cart → Checkout → Submit, Submit threw an error."

**Add `BreadcrumbCapture` class:**

Captures automatically (when `BugReporterProvider` is mounted):
- **Navigation events:** `popstate`, `hashchange`, Next.js/React Router route changes → `{ type: 'navigation', url, timestamp }`
- **Click events:** document-level click listener, capture target element tag + text (truncated to 50 chars) + `data-testid` if present → `{ type: 'click', element, text, timestamp }`
- **Form events:** `submit` events → `{ type: 'form_submit', action, method, timestamp }`
- **Console errors:** already captured by `ConsoleCapture`, deduplicated in timeline

**Configurable:**
```typescript
<BugReporterProvider
  integrations={{ cloud }}
  breadcrumbs={{
    clicks: true,        // default: true
    navigation: true,    // default: true
    forms: true,         // default: true
    maxEntries: 50,      // default: 50
  }}
>
```

**Format:** Last 50 events, newest last, sent as `breadcrumbs` array in FormData:
```json
[
  { "type": "navigation", "url": "/products/123", "timestamp": "..." },
  { "type": "click", "element": "button", "text": "Add to cart", "timestamp": "..." },
  { "type": "navigation", "url": "/cart", "timestamp": "..." },
  { "type": "click", "element": "button", "text": "Checkout", "timestamp": "..." },
  { "type": "console_error", "message": "Uncaught TypeError: ...", "timestamp": "..." }
]
```

**Privacy:** Never capture input field values. Never capture passwords or sensitive text. Only capture element tag, truncated visible text, and `data-testid`.

---

### SDK-07 — Headless capture mode

**Priority:** P2  
**Files:** `packages/core/src/BugReporter.ts`, `packages/react/src/hooks/useBugReporter.ts`

**Problem:** The SDK only works through user-initiated UI. React error boundaries and automated monitoring cannot capture bugs programmatically.

**Add `captureAndSubmit` method:**
```typescript
const reporter = useBugReporter()

// In your React error boundary:
await reporter.captureAndSubmit({
  title: `React error: ${error.message}`,
  description: error.stack,
  captureMode: 'screenshot', // or 'none'
})
// Returns: Promise<{ success: boolean, reportId: string, externalIssueUrl: string | null }>
```

- `captureMode: 'screenshot'` — takes screenshot silently, no UI shown
- `captureMode: 'none'` — submits title/description with metadata and logs, no visual capture
- Floating button and modal never appear during headless capture

---

### SDK-08 — Console capture from page load (not provider mount)

**Priority:** P2  
**File:** `packages/core/src/logging/ConsoleCapture.ts`

**Problem:** `ConsoleCapture` starts intercepting when `BugReporterProvider` mounts. Boot-time errors (before React renders) are missed. These are often the most important errors to capture.

**Change:** Export a `quickCapture()` function that can be called at the very top of the app entry file before any framework code runs:

```typescript
// In main.tsx or index.tsx — before ReactDOM.render
import { quickCapture } from 'quick-bug-reporter-core'
quickCapture() // starts console + error capture immediately
```

`BugReporterProvider` detects if `quickCapture()` has already been called and reuses the existing capture instance instead of creating a new one.

---

### SDK-09 — Privacy and redaction controls

**Priority:** P2  
**Files:** `packages/core/src/integrations/cloud.ts`, `packages/react/src/core/ScreenshotCapturer.ts`

**Problem:** No controls for what gets captured. Enterprise customers and GDPR-compliant apps need to selectively redact sensitive UI elements and log content.

**Add `privacy` option to `CloudIntegration`:**
```typescript
const cloud = new CloudIntegration({
  projectKey: 'qb_live_xxx',
  privacy: {
    // CSS selectors — matched elements are blurred in screenshots
    maskSelectors: ['.credit-card', '[data-private]', '#ssn-field'],
    // Block entire elements from screenshot (replaced with placeholder box)
    blockSelectors: ['.patient-data', '#medical-record'],
    // Keys to redact from console logs and network logs
    redactLogKeys: ['password', 'token', 'ssn', 'dob'],
    // Truncate URLs at this path depth (hides IDs from page_url)
    urlDepth: 3, // /users/12345/orders/67890 → /users/[id]/orders/[id]
  }
})
```

---

### SDK-10 — Vue 3 wrapper

**Priority:** P2  
**Package:** `packages/vue` (new)

Vue 3 composable `useQuickBugs()` wrapping `BugReporter` from `packages/core`. `QuickBugsProvider.vue`, `FloatingBugButton.vue`. Same API surface as React package but Vue-idiomatic. No React dependency. Publish as `quick-bug-reporter-vue`.

---

### SDK-11 — Vanilla JS / script tag version

**Priority:** P2  
**Package:** `packages/vanilla` (new)

UMD bundle exposing `window.QuickBugs`. `QuickBugs.init({ projectKey })`, `QuickBugs.showReporter()`, `QuickBugs.submit({ title, description })`. Self-contained CSS injected into `document.head` on init. Publish as `quick-bug-reporter` on npm and as a CDN-ready `.min.js`.

---

## What the SDK never does

These are explicit non-goals. The SDK is a capture and forward layer only.

- **Never stores data** — everything goes to the ingest endpoint, nothing persisted locally beyond the current session
- **Never makes AI calls** — summarisation, severity scoring, and root cause analysis happen on the platform
- **Never shows analytics** — the floating button and modal are the only UI; dashboards live on the platform
- **Never contacts external services directly** — all data goes to a single configured ingest endpoint
- **Never captures passwords or payment fields** — `<input type="password">` and elements with `autocomplete="cc-number"` are automatically excluded from screenshots

---

## SDK payload reference

Complete payload sent to `/api/ingest` after all SDK improvements are shipped:

```
FormData fields (text):
  project_key           string   required
  title                 string   required
  description           string   legacy concatenated field
  steps_to_reproduce    string   optional
  expected_result       string   optional
  actual_result         string   optional
  additional_context    string   optional
  provider              string   "cloud"
  capture_mode          string   "video" | "screenshot"
  has_screenshot        boolean
  has_video             boolean
  has_network_logs      boolean
  has_console_logs      boolean
  has_breadcrumbs       boolean  new — SDK-06
  js_error_count        number
  user_agent            string
  browser_name          string
  browser_version       string
  os_name               string
  os_version            string
  device_type           string   "mobile" | "tablet" | "desktop"
  screen_resolution     string   "1920x1080"
  viewport              string   "1440x900"
  color_scheme          string   "light" | "dark"
  locale                string
  timezone              string
  connection_type       string
  page_url              string
  environment           string   optional
  app_version           string   optional
  duration_ms           number
  stopped_at            string   ISO timestamp
  capture_has_mic       boolean  new — SDK-01
  user_id               string   optional — SDK-03
  user_email            string   optional — SDK-03
  user_name             string   optional — SDK-03
  custom_metadata       string   JSON — SDK-05

FormData attachments (binary):
  screenshot            Blob     image/png
  video                 Blob     video/webm
  network_logs          Blob     text/plain (includes request/response bodies — SDK-04)
  console_logs          Blob     text/plain
  client_metadata       Blob     application/json
  breadcrumbs           Blob     application/json (new — SDK-06)
```

---

## SDK changelog target — v2.0.0

| Change | SDK item | Breaking? |
|--------|----------|-----------|
| Default endpoint is `https://quickbugs.com/api/ingest` | T-00 | No — was already configurable |
| Mic optional in screen recording | SDK-01 | No |
| XHR interception | SDK-02 | No |
| `user` prop on `BugReporterProvider` | SDK-03 | No — additive |
| `metadata` option for custom fields | SDK-05 | No — additive |
| `captureAndSubmit` headless mode | SDK-07 | No — additive |
| `quickCapture()` for boot-time capture | SDK-08 | No — additive |
| Breadcrumb capture | SDK-06 | No — opt-out available |
| XHR request/response bodies (opt-in) | SDK-04 | No — opt-in only |
| Privacy/redaction controls | SDK-09 | No — additive |

---

*QuickBugs SDK PRD V1.0 · March 2026 · Internal · SIRO & CO FZCO*
