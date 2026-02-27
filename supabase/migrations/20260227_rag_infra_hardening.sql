-- ==============================================================
-- ANCLORA ADVISOR AI - RAG Infra Hardening (idempotent)
-- Project: lvpplnqbyvscpuljnzqf
-- ==============================================================

BEGIN;

-- 1) Required extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Core tables (safe create if missing)
CREATE TABLE IF NOT EXISTS public.rag_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(500) NOT NULL,
  category varchar(100),
  source_url varchar(1000),
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.rag_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.rag_documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(384),
  token_count integer,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- 3) Useful indexes
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id
  ON public.rag_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_rag_documents_category
  ON public.rag_documents(category);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
  ON public.rag_chunks USING hnsw (embedding vector_cosine_ops);

-- 4) RLS baseline
ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rag_documents'
      AND policyname = 'rag_docs_read_policy'
  ) THEN
    CREATE POLICY rag_docs_read_policy
      ON public.rag_documents
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rag_chunks'
      AND policyname = 'rag_chunks_read_policy'
  ) THEN
    CREATE POLICY rag_chunks_read_policy
      ON public.rag_chunks
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 5) Retrieval RPC used by /api/chat and integration tests
CREATE OR REPLACE FUNCTION public.match_chunks(
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
  FROM public.rag_chunks rc
  JOIN public.rag_documents rd ON rc.document_id = rd.id
  WHERE 1 - (rc.embedding <=> query_embedding::vector) > match_threshold
    AND (filter_category IS NULL OR filter_category = '' OR rd.category = filter_category)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_chunks(vector, float, int, text) TO anon, authenticated, service_role;

-- Refresh PostgREST schema cache so RPC is available immediately
NOTIFY pgrst, 'reload schema';

COMMIT;

