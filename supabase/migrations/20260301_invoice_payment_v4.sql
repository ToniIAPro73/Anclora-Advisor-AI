alter table public.invoices
  add column if not exists paid_at timestamptz null,
  add column if not exists payment_method text null,
  add column if not exists payment_reference text null,
  add column if not exists payment_notes text null;

create index if not exists idx_invoices_paid_at on public.invoices (paid_at desc nulls last);
