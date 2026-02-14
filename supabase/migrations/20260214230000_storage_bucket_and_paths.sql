-- Add storage path columns to report_events
ALTER TABLE public.report_events ADD COLUMN IF NOT EXISTS screenshot_path TEXT;
ALTER TABLE public.report_events ADD COLUMN IF NOT EXISTS video_path TEXT;
ALTER TABLE public.report_events ADD COLUMN IF NOT EXISTS network_logs_path TEXT;
ALTER TABLE public.report_events ADD COLUMN IF NOT EXISTS console_logs_path TEXT;
ALTER TABLE public.report_events ADD COLUMN IF NOT EXISTS metadata_path TEXT;

-- Create storage bucket for report attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('report-attachments', 'report-attachments', false, 52428800)
ON CONFLICT (id) DO NOTHING;
