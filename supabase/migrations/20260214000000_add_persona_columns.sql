-- Add persona columns to creators table
ALTER TABLE creators ADD COLUMN IF NOT EXISTS selected_pack TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS tone_id TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS focus_id TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS goal_id TEXT;
