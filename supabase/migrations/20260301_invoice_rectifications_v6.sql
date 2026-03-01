alter table public.invoices
  add column if not exists invoice_type text not null default 'standard',
  add column if not exists rectifies_invoice_id uuid references public.invoices(id) on delete set null,
  add column if not exists rectification_reason text;

create index if not exists idx_invoices_rectifies_invoice_id on public.invoices(rectifies_invoice_id);

update public.invoices
set invoice_type = coalesce(invoice_type, 'standard')
where invoice_type is null;
