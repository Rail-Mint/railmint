CREATE TABLE public.creator_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('post', 'conversation', 'profile')),
  source_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view creator embeddings" ON public.creator_embeddings FOR SELECT USING (true);
CREATE POLICY "Service role can manage creator embeddings" ON public.creator_embeddings FOR ALL USING (true);

CREATE INDEX idx_creator_embeddings_creator_id ON public.creator_embeddings(creator_id);
CREATE INDEX idx_creator_embeddings_source_type ON public.creator_embeddings(source_type);
CREATE INDEX idx_creator_embeddings_source_id ON public.creator_embeddings(source_id);
CREATE INDEX idx_creator_embeddings_updated_at ON public.creator_embeddings(updated_at);

CREATE INDEX idx_creator_embeddings_vector ON public.creator_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TRIGGER update_creator_embeddings_updated_at
  BEFORE UPDATE ON public.creator_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
