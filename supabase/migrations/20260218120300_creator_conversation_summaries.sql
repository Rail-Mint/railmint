CREATE TABLE public.creator_conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  token_count INT NOT NULL DEFAULT 0,
  conversation_count INT NOT NULL DEFAULT 0,
  earliest_timestamp TIMESTAMPTZ NOT NULL,
  latest_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creator_id)
);

ALTER TABLE public.creator_conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view creator conversation summaries" ON public.creator_conversation_summaries FOR SELECT USING (true);
CREATE POLICY "Service role can manage creator conversation summaries" ON public.creator_conversation_summaries FOR ALL USING (true);

CREATE INDEX idx_creator_conversation_summaries_creator_id ON public.creator_conversation_summaries(creator_id);
CREATE INDEX idx_creator_conversation_summaries_updated_at ON public.creator_conversation_summaries(updated_at);
CREATE INDEX idx_creator_conversation_summaries_latest_timestamp ON public.creator_conversation_summaries(latest_timestamp);

CREATE TRIGGER update_creator_conversation_summaries_updated_at
  BEFORE UPDATE ON public.creator_conversation_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
