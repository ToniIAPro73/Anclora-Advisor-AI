BEGIN;

ALTER TABLE public.rag_documents
  ADD COLUMN IF NOT EXISTS doc_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.rag_documents
SET doc_metadata = jsonb_strip_nulls(
  coalesce(doc_metadata, '{}'::jsonb) ||
  jsonb_build_object(
    'source_type',
    CASE
      WHEN source_url IS NULL OR source_url = '' THEN 'generated_text'
      ELSE 'web_page'
    END,
    'jurisdiction',
    CASE
      WHEN lower(title) LIKE '%baleares%' OR lower(title) LIKE '%balears%' OR lower(title) LIKE '%mallorca%' THEN 'es-bal'
      WHEN category IN ('fiscal', 'laboral', 'mercado') THEN 'es'
      ELSE NULL
    END
  )
)
WHERE doc_metadata = '{}'::jsonb OR doc_metadata IS NULL;

CREATE INDEX IF NOT EXISTS idx_rag_documents_doc_metadata_gin
  ON public.rag_documents USING gin (doc_metadata);

COMMIT;
