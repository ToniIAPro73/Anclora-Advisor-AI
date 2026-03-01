create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  paid_at timestamptz not null,
  payment_method text null,
  payment_reference text null,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_payments_invoice on public.invoice_payments (invoice_id, paid_at desc);
create index if not exists idx_invoice_payments_user on public.invoice_payments (user_id, created_at desc);
