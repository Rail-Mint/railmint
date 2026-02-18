CREATE TABLE public.creator_post_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  post_content TEXT NOT NULL,
  post_timestamp TIMESTAMPTZ NOT NULL,
  tags TEXT[] DEFAULT '{}',
  like_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creator_id, post_id)
);

ALTER TABLE public.creator_post_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view creator post index" ON public.creator_post_index FOR SELECT USING (true);
CREATE POLICY "Service role can manage creator post index" ON public.creator_post_index FOR ALL USING (true);

CREATE INDEX idx_creator_post_index_creator_id ON public.creator_post_index(creator_id);
CREATE INDEX idx_creator_post_index_post_id ON public.creator_post_index(post_id);
CREATE INDEX idx_creator_post_index_post_timestamp ON public.creator_post_index(post_timestamp);
CREATE INDEX idx_creator_post_index_updated_at ON public.creator_post_index(updated_at);
CREATE INDEX idx_creator_post_index_tags ON public.creator_post_index USING GIN(tags);

CREATE TRIGGER update_creator_post_index_updated_at
  BEFORE UPDATE ON public.creator_post_index
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
