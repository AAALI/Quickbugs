# QuickBugs Codex Rules

These rules are the default operating instructions for Codex in this repository.
`AGENT_GUIDE.md` is the full source of truth; this file is the quick execution policy.

## 1. Default Architecture
- Treat QuickBugs as cloud-first.
- Prefer `CloudIntegration` unless the user explicitly asks for direct Jira/Linear mode.
- Keep the main end-to-end path intact:
  `packages/react` -> `packages/core/src/integrations/cloud.ts` -> `apps/dashboard/app/api/ingest/route.ts` -> Supabase -> Jira/Linear forwarding.

## 2. Field Change Propagation (No Partial Updates)
- Any new/changed bug report field must be propagated through all required layers:
  1. `packages/core/src/types.ts`
  2. `packages/react/src/core/BugReporter.ts`
  3. `packages/react/src/ui/BugReporterProvider.tsx`
  4. `packages/react/src/ui/BugReporterModal.tsx` (if user-facing)
  5. `packages/core/src/integrations/cloud.ts` (FormData serialization)
  6. `apps/dashboard/app/api/ingest/route.ts` (parse + insert + forwarding data)
  7. `supabase/migrations/*.sql` (schema change when needed)
  8. Jira/Linear description builders in `route.ts` when applicable
- Do not stop after SDK-only or server-only changes.

## 3. Ingest Route Safety Rules
- For multipart parsing in `apps/dashboard/app/api/ingest/route.ts`, iterate `FormData.entries()`.
- Server-side file checks must use `instanceof Blob`, not `instanceof File`.
- Preserve observability logs for ingest/debugging unless there is a clear reason to remove them.

## 4. Build and Verification Rules
- If `packages/core/src/**` changes: rebuild core and react (`pnpm build` preferred).
- If `packages/react/src/**` changes: rebuild `quick-bug-reporter-react` at minimum.
- If behavior looks stale in `test-app-tw3`, clear `test-app-tw3/node_modules/.vite` and restart Vite.
- Prefer validating cloud flow with:
  - dashboard dev server (`@quickbugs/dashboard`, port 3000)
  - `test-app-tw3` (port 5174, proxy to `/api/ingest`)

## 5. Database and Migration Rules
- Never edit or delete historical migrations in `supabase/migrations/`.
- Add new timestamped migrations for schema changes.
- Keep migration naming format: `YYYYMMDDHHMMSS_description.sql`.

## 6. Security and Secrets
- Never hardcode credentials or API tokens in source.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code.
- Respect Vault-based token flow (`create_secret`, `read_secret`, `update_secret`, `delete_secret`).

## 7. Do-Not-Do List
- Do not edit `dist/` artifacts directly.
- Do not manually edit `pnpm-lock.yaml`.
- Do not replace cloud flow logic with direct integration logic by default.
- Do not leave a data path half-migrated when adding/changing payload fields.

