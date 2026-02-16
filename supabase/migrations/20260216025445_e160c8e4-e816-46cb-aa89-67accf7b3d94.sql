
-- Fix overly permissive "Service role can manage" ALL policies
-- Replace USING(true) with explicit service_role check

-- donation_audit_log
DROP POLICY IF EXISTS "Service role can manage donation audit log" ON public.donation_audit_log;
CREATE POLICY "Service role can manage donation audit log"
  ON public.donation_audit_log FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

-- donations
DROP POLICY IF EXISTS "Service role can manage donations" ON public.donations;
CREATE POLICY "Service role can manage donations"
  ON public.donations FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

-- epoch_rewards
DROP POLICY IF EXISTS "Service role can manage epoch rewards" ON public.epoch_rewards;
CREATE POLICY "Service role can manage epoch rewards"
  ON public.epoch_rewards FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

-- epochs
DROP POLICY IF EXISTS "Service role can manage epochs" ON public.epochs;
CREATE POLICY "Service role can manage epochs"
  ON public.epochs FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

-- mentions
DROP POLICY IF EXISTS "Service role can manage mentions" ON public.mentions;
CREATE POLICY "Service role can manage mentions"
  ON public.mentions FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

-- posts
DROP POLICY IF EXISTS "Service role can manage posts" ON public.posts;
CREATE POLICY "Service role can manage posts"
  ON public.posts FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

-- user_roles
DROP POLICY IF EXISTS "Service role can manage roles" ON public.user_roles;
CREATE POLICY "Service role can manage roles"
  ON public.user_roles FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

-- webhook_nonces
DROP POLICY IF EXISTS "Service role can manage webhook nonces" ON public.webhook_nonces;
CREATE POLICY "Service role can manage webhook nonces"
  ON public.webhook_nonces FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);
