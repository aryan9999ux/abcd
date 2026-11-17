-- Free demo accounts: one per user, 3 days, no payouts. Same plan rules as a real account.
alter table public.trading_accounts
  add column is_demo boolean not null default false,
  add column demo_expires_at timestamptz;
create unique index trading_accounts_one_demo_per_user on public.trading_accounts(user_id) where is_demo;
