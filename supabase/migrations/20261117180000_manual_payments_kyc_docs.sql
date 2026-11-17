-- Manual payments (static QR + UTR), full KYC documents, payout rejection reasons.
create table public.payment_settings (
  id int primary key default 1 check (id = 1),
  upi_id text, payee_name text, qr_path text,
  updated_at timestamptz not null default now()
);
insert into public.payment_settings (id) values (1);
alter table public.payment_settings enable row level security;
create policy "signed in read payment settings" on public.payment_settings for select to authenticated using (true);
revoke insert, update, delete on public.payment_settings from anon, authenticated;
revoke all on public.payment_settings from anon;

create sequence public.receipt_seq start 1001;
create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  plan_key text not null references public.plans(key),
  account_size bigint not null,
  amount_inr numeric(12,2) not null,
  gst_inr numeric(12,2) not null default 0,
  utr text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason text,
  purchase_id uuid references public.purchases(id),
  account_id uuid references public.trading_accounts(id),
  receipt_no text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index payment_requests_utr_live on public.payment_requests (utr) where status in ('pending','approved');
create index payment_requests_user_idx on public.payment_requests (user_id, created_at desc);
alter table public.payment_requests enable row level security;
create policy "own payment requests read" on public.payment_requests for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.payment_requests from anon, authenticated;
revoke all on public.payment_requests from anon;

alter table public.kyc_submissions
  add column aadhaar_no text, add column district text, add column state text,
  add column pan_photo text, add column aadhaar_photo text, add column selfie_photo text;
alter table public.rewards add column reject_reason text;

insert into storage.buckets (id, name, public) values ('payment-qr', 'payment-qr', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('kyc-docs', 'kyc-docs', false) on conflict (id) do nothing;

create function public.nextval_receipt() returns bigint language sql security definer set search_path = '' as $$ select nextval('public.receipt_seq') $$;
revoke execute on function public.nextval_receipt() from public, anon, authenticated;
