alter table public.invoices
  drop constraint if exists invoices_import_source_allowed;

alter table public.invoices
  add constraint invoices_import_source_allowed
  check (import_source in ('manual', 'pdf_import', 'image_import'));

comment on column public.invoices.import_source is 'Origen del alta de factura: manual, importada desde PDF o importada desde imagen';
