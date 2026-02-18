CREATE TABLE public.creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  bio TEXT,
  tags TEXT[] DEFAULT '{}',
  interests TEXT[] DEFAULT '{}',
  specialties TEXT[] DEFAULT '{}',
  context_opt_in BOOLEAN NOT NULL DEFAULT false,
  news_enabled BOOLEAN NOT NULL DEFAULT false,
  news_topics TEXT[] DEFAULT '{}',
  news_cadence TEXT CHECK (news_cadence IN ('hourly', 'daily', 'weekly')) DEFAULT 'daily',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creator_id)
);

ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view creator profiles" ON public.creator_profiles FOR SELECT USING (true);
CREATE POLICY "Service role can manage creator profiles" ON public.creator_profiles FOR ALL USING (true);

CREATE INDEX idx_creator_profiles_creator_id ON public.creator_profiles(creator_id);
CREATE INDEX idx_creator_profiles_context_opt_in ON public.creator_profiles(context_opt_in);
CREATE INDEX idx_creator_profiles_news_enabled ON public.creator_profiles(news_enabled);
CREATE INDEX idx_creator_profiles_updated_at ON public.creator_profiles(updated_at);

CREATE TRIGGER update_creator_profiles_updated_at
  BEFORE UPDATE ON public.creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
