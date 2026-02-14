-- Add description column to report_events for storing the user's bug description
ALTER TABLE public.report_events ADD COLUMN description TEXT;
