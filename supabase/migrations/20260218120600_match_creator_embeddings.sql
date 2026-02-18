CREATE OR REPLACE FUNCTION match_creator_embeddings(
  query_embedding vector(1536),
  match_creator_id uuid,
  match_threshold float,
  match_count int,
  cutoff_date timestamptz
)
RETURNS TABLE (
  id uuid,
  creator_id uuid,
  source_id uuid,
  source_type text,
  similarity float,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.id,
    ce.creator_id,
    ce.source_id,
    ce.source_type,
    (1 - (ce.embedding <=> query_embedding))::float as similarity,
    ce.created_at
  FROM creator_embeddings ce
  WHERE ce.creator_id = match_creator_id
    AND ce.created_at >= cutoff_date
    AND (1 - (ce.embedding <=> query_embedding)) > match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
