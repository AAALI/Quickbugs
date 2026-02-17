# Cleanup Old Attachments - Cron Function

This Edge Function automatically deletes report attachments older than 7 days from Supabase Storage.

## Why 7 Days?

- Files are immediately forwarded to Jira/Linear when bug reports are submitted
- The 7-day retention provides a buffer for:
  - Failed forwarding retries
  - Manual recovery if needed
  - Audit trail for recent reports
- Keeps storage costs minimal

## Setup Instructions

### 1. Deploy the Edge Function

```bash
# From project root
supabase functions deploy cleanup-old-attachments
```

### 2. Set Up Cron Trigger in Supabase Dashboard

Since this function needs to run daily, set up a cron trigger:

**Option A: Supabase Dashboard (Recommended)**
1. Go to https://supabase.com/dashboard/project/[your-project]/functions
2. Find `cleanup-old-attachments` function
3. Click "Settings" → "Add Cron Trigger"
4. Schedule: `0 2 * * *` (runs daily at 2 AM UTC)
5. Save

**Option B: Using Supabase CLI (for production)**
```bash
supabase functions schedule cleanup-old-attachments \
  --cron "0 2 * * *" \
  --project-ref your-project-ref
```

### 3. Manual Invocation (Testing)

You can test the function manually:

```bash
curl -X POST \
  'https://[your-project-ref].supabase.co/functions/v1/cleanup-old-attachments' \
  -H "Authorization: Bearer [YOUR_ANON_KEY]" \
  -H "Content-Type: application/json"
```

## How It Works

1. Runs daily at 2 AM UTC
2. Lists all files in `report-attachments` bucket
3. Filters files older than 7 days
4. Batch deletes old files
5. Returns count of deleted files

## Monitoring

Check function logs in Supabase Dashboard:
- Navigate to Functions → cleanup-old-attachments → Logs
- Review deletion counts and any errors

## Security

- Uses `SUPABASE_SERVICE_ROLE_KEY` for admin access to storage
- Requires Bearer token authentication
- Only accepts POST requests (cron uses POST)
