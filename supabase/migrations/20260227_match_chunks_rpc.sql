-- ==============================================================
-- ANCLORA ADVISOR AI - RAG Retrieval RPC
-- match_chunks: Semantic similarity search on rag_chunks
-- Category values: 'fiscal' | 'laboral' | 'mercado'
-- ==============================================================

CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  filter_category text DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.document_id,
    rc.content,
    jsonb_build_object(
      'title',      rd.title,
      'category',   rd.category,
      'source_url', rd.source_url
    ) AS metadata,
    1 - (rc.embedding <=> query_embedding::vector) AS similarity
  FROM rag_chunks rc
  JOIN rag_documents rd ON rc.document_id = rd.id
  WHERE 1 - (rc.embedding <=> query_embedding::vector) > match_threshold
    AND (filter_category IS NULL OR filter_category = '' OR rd.category = filter_category)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
