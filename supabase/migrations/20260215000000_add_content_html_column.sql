-- Add content_html column for rich text content storage
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_html TEXT DEFAULT '';
