CREATE TABLE IF NOT EXISTS public.rag_ingest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notebook_id UUID NOT NULL,
  notebook_title VARCHAR(255) NOT NULL,
  domain VARCHAR(50) NOT NULL,
  project_ref VARCHAR(64) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  source_count INTEGER NOT NULL DEFAULT 0,
  documents_processed INTEGER NOT NULL DEFAULT 0,
  chunks_inserted INTEGER NOT NULL DEFAULT 0,
  replaced_documents INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  job_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rag_ingest_jobs_created_at ON public.rag_ingest_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_ingest_jobs_requested_by ON public.rag_ingest_jobs(requested_by);
CREATE INDEX IF NOT EXISTS idx_rag_ingest_jobs_status ON public.rag_ingest_jobs(status);

ALTER TABLE public.rag_ingest_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rag_ingest_jobs'
      AND policyname = 'rag_ingest_jobs_self_read_policy'
  ) THEN
    CREATE POLICY rag_ingest_jobs_self_read_policy
      ON public.rag_ingest_jobs
      FOR SELECT
      USING (requested_by = auth.uid());
  END IF;
END $$;
