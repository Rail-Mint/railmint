ALTER TABLE public.creators ADD COLUMN IF NOT EXISTS agentic_context_opt_in BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_creators_opt_in ON public.creators(agentic_context_opt_in) WHERE agentic_context_opt_in = true;
