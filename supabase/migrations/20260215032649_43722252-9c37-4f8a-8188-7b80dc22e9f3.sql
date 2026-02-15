
-- Fix #1: Tighten RLS policies on creators, likes, posts
-- Remove overly permissive write policies and restrict writes to service_role only

-- === CREATORS TABLE ===
DROP POLICY IF EXISTS "Creator can insert own profile" ON public.creators;
DROP POLICY IF EXISTS "Creator can update own profile" ON public.creators;

-- Only service_role (edge functions) can insert/update creators
CREATE POLICY "Service role can insert creators"
  ON public.creators FOR INSERT
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
  );

CREATE POLICY "Service role can update creators"
  ON public.creators FOR UPDATE
  USING (
    (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
  );

-- === LIKES TABLE ===
DROP POLICY IF EXISTS "Anyone can insert likes" ON public.likes;
DROP POLICY IF EXISTS "Anyone can delete own likes" ON public.likes;

-- Only service_role (edge functions) can insert/delete likes
CREATE POLICY "Service role can insert likes"
  ON public.likes FOR INSERT
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
  );

CREATE POLICY "Service role can delete likes"
  ON public.likes FOR DELETE
  USING (
    (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
  );

-- === POSTS TABLE ===
-- Posts already has "Service role can manage posts" for ALL, but let's also ensure
-- no anon user can insert directly (the existing SELECT policy stays)
-- The existing "Service role can manage posts" policy already covers this via ALL command
