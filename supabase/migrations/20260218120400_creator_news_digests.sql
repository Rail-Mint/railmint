CREATE TABLE public.creator_news_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('hourly', 'daily', 'weekly')),
  digest_bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_news_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view creator news digests" ON public.creator_news_digests FOR SELECT USING (true);
CREATE POLICY "Service role can manage creator news digests" ON public.creator_news_digests FOR ALL USING (true);

CREATE INDEX idx_creator_news_digests_creator_id ON public.creator_news_digests(creator_id);
CREATE INDEX idx_creator_news_digests_topic ON public.creator_news_digests(topic);
CREATE INDEX idx_creator_news_digests_updated_at ON public.creator_news_digests(updated_at);
CREATE INDEX idx_creator_news_digests_last_fetched_at ON public.creator_news_digests(last_fetched_at);

CREATE TRIGGER update_creator_news_digests_updated_at
  BEFORE UPDATE ON public.creator_news_digests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
