-- Engine bookkeeping: daily-loss reset marker and trading-day counter marker (IST dates).
-- Already applied to Supabase project "prop-f" as migration "engine_account_day_columns".
alter table public.trading_accounts
  add column day_start_date date,
  add column last_trading_date date;

-- Tick job scans pending orders across accounts.
create index orders_pending_idx on public.orders (created_at) where status = 'pending';
