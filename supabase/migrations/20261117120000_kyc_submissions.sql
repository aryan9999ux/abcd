-- Trader identity and payout details. Written only by the server; the trader can read their own row.
create table public.kyc_submissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  pan text not null,
  payout_method text not null check (payout_method in ('upi','bank')),
  upi_id text,
  bank_account text,
  bank_ifsc text,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  reviewer_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.kyc_submissions enable row level security;
create policy "own kyc submission read" on public.kyc_submissions for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.kyc_submissions from anon, authenticated;
revoke all on public.kyc_submissions from anon;
