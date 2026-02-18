
-- Add X verification columns to creators
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS x_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS x_verified_at timestamp with time zone;

-- Create mentions table for X mention pipeline
CREATE TABLE IF NOT EXISTS public.mentions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mention_id text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'x',
  author_handle text,
  author_wallet text,
  raw_text text NOT NULL,
  parsed_intent text NOT NULL DEFAULT 'unknown',
  status text NOT NULL DEFAULT 'received',
  payload jsonb DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamp with time zone,
  error_text text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage mentions" ON public.mentions;
CREATE POLICY "Service role can manage mentions"
  ON public.mentions FOR ALL
  USING (true);

-- Create donations table
CREATE TABLE IF NOT EXISTS public.donations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mention_id uuid REFERENCES public.mentions(id),
  donor_wallet text NOT NULL,
  recipient_creator_id uuid REFERENCES public.creators(id),
  recipient_wallet text NOT NULL,
  amount numeric NOT NULL,
  asset_symbol text NOT NULL DEFAULT 'BNB',
  chain_id integer NOT NULL DEFAULT 56,
  status text NOT NULL DEFAULT 'pending',
  tx_hash text,
  failure_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage donations" ON public.donations;
CREATE POLICY "Service role can manage donations"
  ON public.donations FOR ALL
  USING (true);

-- Create donation audit log
CREATE TABLE IF NOT EXISTS public.donation_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  donation_id uuid REFERENCES public.donations(id),
  event_type text NOT NULL,
  tx_hash text,
  error_text text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.donation_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage donation audit log" ON public.donation_audit_log;
CREATE POLICY "Service role can manage donation audit log"
  ON public.donation_audit_log FOR ALL
  USING (true);

-- Create webhook nonces for replay protection
CREATE TABLE IF NOT EXISTS public.webhook_nonces (
  nonce text PRIMARY KEY,
  expires_at timestamp with time zone NOT NULL
);

ALTER TABLE public.webhook_nonces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage webhook nonces" ON public.webhook_nonces;
CREATE POLICY "Service role can manage webhook nonces"
  ON public.webhook_nonces FOR ALL
  USING (true);
