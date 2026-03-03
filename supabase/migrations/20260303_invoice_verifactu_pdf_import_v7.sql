alter table public.invoices
  add column if not exists verifactu_status text not null default 'not_sent',
  add column if not exists verifactu_submitted_at timestamp,
  add column if not exists verifactu_submission_id text,
  add column if not exists verifactu_last_error text,
  add column if not exists import_source text not null default 'manual',
  add column if not exists import_file_name text,
  add column if not exists import_storage_path text,
  add column if not exists import_confidence numeric(5,2),
  add column if not exists imported_at timestamp;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_verifactu_status_allowed'
  ) then
    alter table public.invoices
      add constraint invoices_verifactu_status_allowed
      check (verifactu_status in ('not_sent', 'queued', 'submitted', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_import_source_allowed'
  ) then
    alter table public.invoices
      add constraint invoices_import_source_allowed
      check (import_source in ('manual', 'pdf_import'));
  end if;
end $$;

create index if not exists idx_invoices_verifactu_status on public.invoices (user_id, verifactu_status, created_at desc);
create index if not exists idx_invoices_import_source on public.invoices (user_id, import_source, created_at desc);

comment on column public.invoices.verifactu_status is 'Estado de entrega de la factura hacia Verifactu';
comment on column public.invoices.import_source is 'Origen del alta de factura: manual o importada desde PDF';
