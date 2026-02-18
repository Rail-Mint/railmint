
-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Step 2: Create creator_profiles table
CREATE TABLE IF NOT EXISTS public.creator_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  bio TEXT,
  tags TEXT[] DEFAULT '{}',
  interests TEXT[] DEFAULT '{}',
  specialties TEXT[] DEFAULT '{}',
  context_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(creator_id)
);

ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view creator profiles"
  ON public.creator_profiles FOR SELECT USING (true);

CREATE POLICY "Service role can manage creator profiles"
  ON public.creator_profiles FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_creator_id ON public.creator_profiles(creator_id);

CREATE TRIGGER update_creator_profiles_updated_at
  BEFORE UPDATE ON public.creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 3: Create creator_post_index table
CREATE TABLE IF NOT EXISTS public.creator_post_index (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  tags TEXT[] DEFAULT '{}',
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(creator_id, post_id)
);

ALTER TABLE public.creator_post_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view creator post index"
  ON public.creator_post_index FOR SELECT USING (true);

CREATE POLICY "Service role can manage creator post index"
  ON public.creator_post_index FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

CREATE INDEX IF NOT EXISTS idx_creator_post_index_creator_id ON public.creator_post_index(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_post_index_post_id ON public.creator_post_index(post_id);
CREATE INDEX IF NOT EXISTS idx_creator_post_index_updated_at ON public.creator_post_index(updated_at DESC);

CREATE TRIGGER update_creator_post_index_updated_at
  BEFORE UPDATE ON public.creator_post_index
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 4: Create creator_conversation_summaries table
CREATE TABLE IF NOT EXISTS public.creator_conversation_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  mention_id UUID REFERENCES public.mentions(id) ON DELETE SET NULL,
  summary_text TEXT NOT NULL,
  topic TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view conversation summaries"
  ON public.creator_conversation_summaries FOR SELECT USING (true);

CREATE POLICY "Service role can manage conversation summaries"
  ON public.creator_conversation_summaries FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

CREATE INDEX IF NOT EXISTS idx_creator_conversation_summaries_creator_id ON public.creator_conversation_summaries(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_conversation_summaries_updated_at ON public.creator_conversation_summaries(updated_at DESC);

CREATE TRIGGER update_creator_conversation_summaries_updated_at
  BEFORE UPDATE ON public.creator_conversation_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 5: Create creator_news_digests table
CREATE TABLE IF NOT EXISTS public.creator_news_digests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  digest_text TEXT NOT NULL,
  source_urls TEXT[] DEFAULT '{}',
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_news_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view news digests"
  ON public.creator_news_digests FOR SELECT USING (true);

CREATE POLICY "Service role can manage news digests"
  ON public.creator_news_digests FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

CREATE INDEX IF NOT EXISTS idx_creator_news_digests_creator_id ON public.creator_news_digests(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_news_digests_topic ON public.creator_news_digests(topic);
CREATE INDEX IF NOT EXISTS idx_creator_news_digests_fetched_at ON public.creator_news_digests(fetched_at DESC);

CREATE TRIGGER update_creator_news_digests_updated_at
  BEFORE UPDATE ON public.creator_news_digests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 6: Create creator_embeddings table
CREATE TABLE IF NOT EXISTS public.creator_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  embedding public.vector(1536) NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('post', 'conversation', 'profile')),
  source_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view creator embeddings"
  ON public.creator_embeddings FOR SELECT USING (true);

CREATE POLICY "Service role can manage creator embeddings"
  ON public.creator_embeddings FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

CREATE INDEX IF NOT EXISTS idx_creator_embeddings_creator_id ON public.creator_embeddings(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_embeddings_source_type ON public.creator_embeddings(source_type);
CREATE INDEX IF NOT EXISTS idx_creator_embeddings_vector
  ON public.creator_embeddings
  USING ivfflat (embedding public.vector_cosine_ops)
  WITH (lists = '100');

CREATE TRIGGER update_creator_embeddings_updated_at
  BEFORE UPDATE ON public.creator_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 7: Create match_creator_embeddings function
CREATE OR REPLACE FUNCTION public.match_creator_embeddings(
  query_embedding public.vector(1536),
  creator_id_filter UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  history_cutoff TIMESTAMP WITH TIME ZONE DEFAULT (now() - INTERVAL '90 days')
)
RETURNS TABLE (
  id UUID,
  creator_id UUID,
  source_type TEXT,
  source_id TEXT,
  metadata JSONB,
  similarity FLOAT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    ce.id,
    ce.creator_id,
    ce.source_type,
    ce.source_id,
    ce.metadata,
    1 - (ce.embedding <=> query_embedding) AS similarity,
    ce.created_at
  FROM public.creator_embeddings ce
  WHERE
    ce.creator_id = creator_id_filter
    AND ce.created_at >= history_cutoff
    AND 1 - (ce.embedding <=> query_embedding) >= match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Step 8: Add agentic_context_opt_in column to creators
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS agentic_context_opt_in BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_creators_opt_in ON public.creators(agentic_context_opt_in);
