ALTER TABLE public.posts
  DROP COLUMN IF EXISTS is_fallback;

UPDATE public.donations
SET status = 'failed',
    failure_reason = COALESCE(failure_reason, 'Legacy simulated donation status removed')
WHERE status = 'simulated';

ALTER TABLE public.donations
  DROP CONSTRAINT IF EXISTS donations_status_check;

ALTER TABLE public.donations
  ADD CONSTRAINT donations_status_check
  CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed'));

UPDATE public.donation_audit_log
SET event_type = 'failed',
    error_text = COALESCE(error_text, 'Legacy simulated audit event migrated to failed')
WHERE event_type = 'simulated';

ALTER TABLE public.donation_audit_log
  DROP CONSTRAINT IF EXISTS donation_audit_log_event_type_check;

ALTER TABLE public.donation_audit_log
  ADD CONSTRAINT donation_audit_log_event_type_check
  CHECK (event_type IN ('initiated', 'submitted', 'confirmed', 'failed'));
