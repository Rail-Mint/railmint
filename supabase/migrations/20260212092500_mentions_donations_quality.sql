CREATE TABLE public.mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL DEFAULT 'x',
  mention_id TEXT NOT NULL UNIQUE,
  author_handle TEXT,
  author_wallet TEXT,
  raw_text TEXT NOT NULL,
  parsed_intent TEXT NOT NULL DEFAULT 'unknown' CHECK (parsed_intent IN ('publish', 'ask', 'donate', 'unknown')),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE public.webhook_nonces (
  nonce TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id UUID REFERENCES public.mentions(id) ON DELETE SET NULL,
  donor_wallet TEXT NOT NULL,
  recipient_creator_id UUID REFERENCES public.creators(id) ON DELETE SET NULL,
  recipient_wallet TEXT NOT NULL,
  amount NUMERIC(18,8) NOT NULL CHECK (amount > 0),
  asset_symbol TEXT NOT NULL DEFAULT 'BNB',
  chain_id INT NOT NULL DEFAULT 56,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed', 'simulated')),
  tx_hash TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.donation_audit_log (
  id BIGSERIAL PRIMARY KEY,
  donation_id UUID REFERENCES public.donations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('initiated', 'simulated', 'submitted', 'confirmed', 'failed')),
  tx_hash TEXT,
  error_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_donations_updated_at
  BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.posts
  ADD COLUMN quality_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  ADD COLUMN moderation_score NUMERIC(8,4) NOT NULL DEFAULT 1,
  ADD COLUMN engagement_score NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN composite_score NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN content_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  ADD COLUMN source_platform TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN source_reference TEXT;

ALTER TABLE public.epoch_rewards
  ADD COLUMN quality_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  ADD COLUMN moderation_score NUMERIC(8,4) NOT NULL DEFAULT 1,
  ADD COLUMN composite_score NUMERIC(12,4) NOT NULL DEFAULT 0;

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage mentions" ON public.mentions FOR ALL USING (true);
CREATE POLICY "Anyone can view mentions" ON public.mentions FOR SELECT USING (true);

CREATE POLICY "Service role can manage donations" ON public.donations FOR ALL USING (true);
CREATE POLICY "Anyone can view donations" ON public.donations FOR SELECT USING (true);

CREATE POLICY "Service role can manage webhook nonces" ON public.webhook_nonces FOR ALL USING (true);
CREATE POLICY "Service role can manage donation audit log" ON public.donation_audit_log FOR ALL USING (true);
CREATE POLICY "Anyone can view donation audit log" ON public.donation_audit_log FOR SELECT USING (true);

CREATE INDEX idx_mentions_mention_id ON public.mentions(mention_id);
CREATE INDEX idx_mentions_intent_status ON public.mentions(parsed_intent, status);
CREATE INDEX idx_donations_status_created ON public.donations(status, created_at DESC);
CREATE INDEX idx_webhook_nonces_expires_at ON public.webhook_nonces(expires_at);
CREATE INDEX idx_donation_audit_log_donation_id ON public.donation_audit_log(donation_id);
CREATE INDEX idx_posts_composite_score ON public.posts(composite_score DESC);
CREATE INDEX idx_posts_source_ref ON public.posts(source_platform, source_reference);
