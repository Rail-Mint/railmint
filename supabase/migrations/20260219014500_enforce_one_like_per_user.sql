WITH ranked_likes AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY post_id, lower(wallet_address)
      ORDER BY created_at ASC, id ASC
    ) AS row_number
  FROM public.likes
)
DELETE FROM public.likes likes
USING ranked_likes
WHERE likes.id = ranked_likes.id
  AND ranked_likes.row_number > 1;

UPDATE public.likes
SET wallet_address = lower(wallet_address)
WHERE wallet_address <> lower(wallet_address);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'likes_wallet_address_lowercase'
      AND conrelid = 'public.likes'::regclass
  ) THEN
    ALTER TABLE public.likes
      ADD CONSTRAINT likes_wallet_address_lowercase
      CHECK (wallet_address = lower(wallet_address));
  END IF;
END;
$$;
