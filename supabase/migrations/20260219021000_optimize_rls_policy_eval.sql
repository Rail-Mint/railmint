ALTER POLICY "Users can view own roles"
ON public.user_roles
USING ((select auth.uid()) = user_id);

ALTER POLICY "Service role can insert creators"
ON public.creators
TO service_role
WITH CHECK (true);

ALTER POLICY "Service role can update creators"
ON public.creators
TO service_role
USING (true);

ALTER POLICY "Service role can insert likes"
ON public.likes
TO service_role
WITH CHECK (true);

ALTER POLICY "Service role can delete likes"
ON public.likes
TO service_role
USING (true);

ALTER POLICY "Service role can manage donation audit log"
ON public.donation_audit_log
TO service_role
USING (true)
WITH CHECK (true);

ALTER POLICY "Service role can manage donations"
ON public.donations
TO service_role
USING (true)
WITH CHECK (true);

ALTER POLICY "Service role can manage epoch rewards"
ON public.epoch_rewards
TO service_role
USING (true)
WITH CHECK (true);

ALTER POLICY "Service role can manage epochs"
ON public.epochs
TO service_role
USING (true)
WITH CHECK (true);

ALTER POLICY "Service role can manage mentions"
ON public.mentions
TO service_role
USING (true)
WITH CHECK (true);

ALTER POLICY "Service role can manage posts"
ON public.posts
TO service_role
USING (true)
WITH CHECK (true);

ALTER POLICY "Service role can manage roles"
ON public.user_roles
TO service_role
USING (true)
WITH CHECK (true);

ALTER POLICY "Service role can manage webhook nonces"
ON public.webhook_nonces
TO service_role
USING (true)
WITH CHECK (true);

ALTER POLICY "Service role can manage wallet activity log"
ON public.wallet_activity_log
TO service_role
USING (true)
WITH CHECK (true);
