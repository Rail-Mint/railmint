ALTER TABLE public.mentions DROP CONSTRAINT IF EXISTS mentions_status_check;

ALTER TABLE public.mentions
  ADD CONSTRAINT mentions_status_check
  CHECK (status IN ('received', 'processing', 'processed', 'ignored', 'failed'));

ALTER TABLE public.mentions
  ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_mentions_status_created_at
  ON public.mentions(status, created_at);
