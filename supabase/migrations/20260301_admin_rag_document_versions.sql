create table if not exists public.rag_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.rag_documents(id) on delete cascade,
  version_number integer not null,
  snapshot_reason text not null,
  title text not null,
  category text,
  source_url text,
  doc_metadata jsonb,
  chunk_count integer not null default 0,
  chunk_char_count integer not null default 0,
  snapshot_payload jsonb not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_rag_document_versions_document_version
  on public.rag_document_versions(document_id, version_number);

create index if not exists idx_rag_document_versions_document_created_at
  on public.rag_document_versions(document_id, created_at desc);
