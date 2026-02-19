-- 1. Explicit DENY for anon SELECT on mentions table
--    (service_role ALL policy already exists; this locks out anonymous reads)
CREATE POLICY "Deny anonymous SELECT on mentions"
  ON public.mentions
  FOR SELECT
  TO anon
  USING (false);

-- 2. Restrict creators SELECT to authenticated role only
--    Wallet addresses and X handles should not be bulk-harvested by anonymous clients
DROP POLICY IF EXISTS "Anyone can view creators" ON public.creators;

CREATE POLICY "Authenticated users can view creators"
  ON public.creators
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow anon to read only non-sensitive creator fields via a public view
-- (used by public feed / leaderboard for unauthenticated visitors)
CREATE OR REPLACE VIEW public.creators_public
WITH (security_invoker = on) AS
  SELECT
    id,
    clone_name,
    x_handle,
    persona_text,
    is_active,
    x_verified,
    x_verified_at,
    created_at,
    updated_at
    -- wallet_address intentionally excluded from public view
  FROM public.creators
  WHERE is_active = true;