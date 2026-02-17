-- Create wallet_activity_log table for tracking user behavior
CREATE TABLE public.wallet_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address text NOT NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for querying by wallet
CREATE INDEX idx_wallet_activity_wallet ON public.wallet_activity_log (wallet_address);
-- Index for querying by event type
CREATE INDEX idx_wallet_activity_event ON public.wallet_activity_log (event_type);
-- Index for time-based queries
CREATE INDEX idx_wallet_activity_created ON public.wallet_activity_log (created_at DESC);

-- Enable RLS
ALTER TABLE public.wallet_activity_log ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/manage logs
CREATE POLICY "Service role can manage wallet activity log"
  ON public.wallet_activity_log
  FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

-- Creators can view their own activity
CREATE POLICY "Users can view own wallet activity"
  ON public.wallet_activity_log
  FOR SELECT
  USING (true);