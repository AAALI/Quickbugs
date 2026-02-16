-- Add structured bug report fields to report_events table
-- These fields allow for better organized bug reports with separate sections for
-- steps to reproduce, expected vs actual results, and additional context

ALTER TABLE public.report_events 
  ADD COLUMN steps_to_reproduce TEXT,
  ADD COLUMN expected_result TEXT,
  ADD COLUMN actual_result TEXT,
  ADD COLUMN additional_context TEXT;

-- Add helpful comments
COMMENT ON COLUMN public.report_events.steps_to_reproduce IS 
  'Structured field: Steps to reproduce the bug';

COMMENT ON COLUMN public.report_events.expected_result IS 
  'Structured field: What was expected to happen';

COMMENT ON COLUMN public.report_events.actual_result IS 
  'Structured field: What actually happened';

COMMENT ON COLUMN public.report_events.additional_context IS 
  'Structured field: Additional context, workarounds, or notes';

COMMENT ON COLUMN public.report_events.description IS 
  'Legacy/concatenated field containing all bug details for backward compatibility';
