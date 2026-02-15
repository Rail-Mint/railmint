
-- Drop public SELECT policies on operational tables
DROP POLICY IF EXISTS "Anyone can view mentions" ON public.mentions;
DROP POLICY IF EXISTS "Anyone can view donations" ON public.donations;
DROP POLICY IF EXISTS "Anyone can view donation audit log" ON public.donation_audit_log;
