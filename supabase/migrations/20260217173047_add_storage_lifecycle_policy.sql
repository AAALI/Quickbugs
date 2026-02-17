-- Add 7-day lifecycle policy to report-attachments bucket
-- Files will be automatically deleted 7 days after creation
-- This is safe because files are already forwarded to Jira/Linear

-- Supabase Storage doesn't support lifecycle policies directly in the schema
-- Instead, we'll need to use a cron job to clean up old files
-- For now, we'll add a function and trigger to track file age

-- Create a function to delete old storage files (7 days)
CREATE OR REPLACE FUNCTION delete_old_report_attachments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete files older than 7 days from report-attachments bucket
  DELETE FROM storage.objects
  WHERE bucket_id = 'report-attachments'
    AND created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_old_report_attachments() TO authenticated;

-- Note: This function should be called via a cron job or scheduled task
-- For Supabase, you can set up pg_cron or use Supabase Edge Functions with cron triggers
-- Example cron setup (requires pg_cron extension):
-- SELECT cron.schedule(
--   'cleanup-old-attachments',
--   '0 2 * * *',  -- Run daily at 2 AM
--   $$SELECT delete_old_report_attachments();$$
-- );
