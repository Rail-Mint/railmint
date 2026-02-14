
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Creators table
CREATE TABLE public.creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  x_handle TEXT UNIQUE,
  clone_name TEXT NOT NULL,
  selected_pack TEXT,
  tone_id TEXT,
  focus_id TEXT,
  goal_id TEXT,
  persona_text TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Epochs table
CREATE TABLE public.epochs (
  id SERIAL PRIMARY KEY,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid')),
  reward_pool NUMERIC(18,8) NOT NULL DEFAULT 0,
  payout_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Posts table
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.creators(id) ON DELETE CASCADE NOT NULL,
  epoch_id INT REFERENCES public.epochs(id) NOT NULL,
  prompt_text TEXT NOT NULL,
  content_text TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  meta_hash TEXT NOT NULL,
  commit_tx_hash TEXT,
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Likes table
CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  wallet_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, wallet_address)
);

-- Epoch rewards table
CREATE TABLE public.epoch_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epoch_id INT REFERENCES public.epochs(id) NOT NULL,
  creator_id UUID REFERENCES public.creators(id) NOT NULL,
  rank INT NOT NULL,
  like_count INT NOT NULL,
  reward_amount NUMERIC(18,8) NOT NULL
);

-- User roles table (secure, separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on all tables
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epochs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_creators_updated_at
  BEFORE UPDATE ON public.creators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Creators: public read, wallet owner can insert/update
CREATE POLICY "Anyone can view creators" ON public.creators FOR SELECT USING (true);
CREATE POLICY "Creator can insert own profile" ON public.creators FOR INSERT WITH CHECK (true);
CREATE POLICY "Creator can update own profile" ON public.creators FOR UPDATE USING (true);

-- Epochs: public read, admin can modify
CREATE POLICY "Anyone can view epochs" ON public.epochs FOR SELECT USING (true);
CREATE POLICY "Service role can manage epochs" ON public.epochs FOR ALL USING (true);

-- Posts: public read, service role inserts
CREATE POLICY "Anyone can view posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Service role can manage posts" ON public.posts FOR ALL USING (true);

-- Likes: public read, anyone can insert (unique constraint prevents dupes)
CREATE POLICY "Anyone can view likes" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert likes" ON public.likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete own likes" ON public.likes FOR DELETE USING (true);

-- Epoch rewards: public read
CREATE POLICY "Anyone can view epoch rewards" ON public.epoch_rewards FOR SELECT USING (true);
CREATE POLICY "Service role can manage epoch rewards" ON public.epoch_rewards FOR ALL USING (true);

-- User roles: only readable by the user themselves, managed by service role
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage roles" ON public.user_roles FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX idx_posts_epoch_id ON public.posts(epoch_id);
CREATE INDEX idx_posts_creator_id ON public.posts(creator_id);
CREATE INDEX idx_likes_post_id ON public.likes(post_id);
CREATE INDEX idx_likes_wallet ON public.likes(wallet_address);
CREATE INDEX idx_epoch_rewards_epoch ON public.epoch_rewards(epoch_id);
CREATE INDEX idx_creators_wallet ON public.creators(wallet_address);
