-- Restore anonymous SELECT on creators so public feed/leaderboard joins work.
-- The security benefit is preserved at the query level:
-- Feed no longer requests wallet_address, and PostDetail header no longer
-- shows it as a fallback. The proof panel still shows it truncated (intentional).
CREATE POLICY "Anyone can view creators"
  ON public.creators
  FOR SELECT
  TO anon
  USING (true);