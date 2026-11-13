-- Per-plan rules (settings), per-account rule snapshot, stop loss, payout cycle state, KYC flag.
alter table public.plans add column rules jsonb;
alter table public.trading_accounts
  add column rules jsonb,
  add column peak_eod_balance numeric(14,2),
  add column cycle_no int not null default 0,
  add column cycle_start_date date,
  add column payouts_count int not null default 0;
alter table public.orders add column stop_loss numeric(14,2), add column risk_inr numeric(14,2);
alter table public.positions add column stop_loss numeric(14,2);
alter table public.rewards
  add column fee_refund_inr numeric(12,2) not null default 0,
  add column cycle_no int,
  add column gross_profit_inr numeric(14,2);

create table public.day_results (
  account_id uuid not null references public.trading_accounts(id) on delete cascade,
  cycle_no int not null,
  day date not null,
  pnl numeric(14,2) not null default 0,
  primary key (account_id, cycle_no, day)
);
create table public.kyc_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verified boolean not null default false,
  note text,
  updated_at timestamptz not null default now()
);
alter table public.day_results enable row level security;
alter table public.kyc_status enable row level security;
create policy "own kyc read" on public.kyc_status for select to authenticated using ((select auth.uid()) = user_id);
create policy "own day results read" on public.day_results for select to authenticated
  using (exists (select 1 from public.trading_accounts a where a.id = account_id and a.user_id = (select auth.uid())));
revoke insert, update, delete on public.day_results, public.kyc_status from anon, authenticated;
revoke all on public.day_results, public.kyc_status from anon;
