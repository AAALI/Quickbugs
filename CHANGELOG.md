# Changelog

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

## Previous Releases

See git history for earlier versions.
