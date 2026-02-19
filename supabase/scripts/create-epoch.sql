-- ============================================================
-- create_epoch: Admin-only function to create reward epochs
-- Run in Supabase SQL Editor or via migration
-- ============================================================

-- Function: create_epoch(start_at, end_at, reward_pool)
-- Validates: date ordering, no overlap with existing open epochs
-- Returns: the new epoch row
CREATE OR REPLACE FUNCTION create_epoch(
  p_start_at   TIMESTAMPTZ,
  p_end_at     TIMESTAMPTZ,
  p_reward_pool NUMERIC(18,8) DEFAULT 0
)
RETURNS SETOF epochs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate date ordering
  IF p_start_at >= p_end_at THEN
    RAISE EXCEPTION 'start_at must be before end_at';
  END IF;

  -- Check for overlapping open epochs
  IF EXISTS (
    SELECT 1 FROM epochs
    WHERE status = 'open'
      AND p_start_at < end_at
      AND p_end_at > start_at
  ) THEN
    RAISE EXCEPTION 'New epoch overlaps with an existing open epoch';
  END IF;

  -- Insert and return the new epoch
  RETURN QUERY
  INSERT INTO epochs (start_at, end_at, reward_pool, status)
  VALUES (p_start_at, p_end_at, p_reward_pool, 'open')
  RETURNING *;
END;
$$;

-- Restrict to service_role only (not callable by anon/authenticated)
REVOKE EXECUTE ON FUNCTION create_epoch FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_epoch FROM anon;
REVOKE EXECUTE ON FUNCTION create_epoch FROM authenticated;

-- ============================================================
-- USAGE (paste in Supabase SQL Editor):
--
--   SELECT * FROM create_epoch(
--     '2026-02-20 00:00:00+00',   -- start
--     '2026-02-27 00:00:00+00',   -- end
--     1.00000000                   -- reward pool in BNB
--   );
--
-- ============================================================
