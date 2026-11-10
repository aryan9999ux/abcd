-- Applied to Supabase project "prop-f". Trading tables are read-only for traders; only the server (service role) writes them.

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Plans and prices (public catalogue)
create table public.plans (
  key text primary key,
  name text not null,
  evaluation_phases int not null check (evaluation_phases between 0 and 2),
  phase1_target_pct numeric(5,2),
  phase2_target_pct numeric(5,2),
  max_daily_loss_pct numeric(5,2) not null,
  max_overall_loss_pct numeric(5,2) not null,
  min_trading_days int not null default 5,
  reward_split_pct numeric(5,2) not null default 80,
  active boolean not null default true
);
create table public.plan_prices (
  plan_key text not null references public.plans(key) on delete cascade,
  account_size bigint not null check (account_size > 0),
  price_inr numeric(12,2) not null check (price_inr >= 0),
  primary key (plan_key, account_size)
);

-- Purchases
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  plan_key text not null references public.plans(key),
  account_size bigint not null,
  amount_inr numeric(12,2) not null,
  gst_inr numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  gateway_ref text,
  created_at timestamptz not null default now()
);
create index purchases_user_idx on public.purchases(user_id);
create index purchases_plan_idx on public.purchases(plan_key);

-- Trading accounts
create table public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  purchase_id uuid references public.purchases(id) on delete set null,
  plan_key text not null references public.plans(key),
  account_size bigint not null,
  phase text not null default 'phase_1' check (phase in ('phase_1','phase_2','funded')),
  status text not null default 'active' check (status in ('active','passed','breached','closed')),
  balance numeric(14,2) not null,
  day_start_equity numeric(14,2) not null,
  trading_days int not null default 0,
  breach_reason text,
  created_at timestamptz not null default now()
);
create index trading_accounts_user_idx on public.trading_accounts(user_id);
create index trading_accounts_purchase_idx on public.trading_accounts(purchase_id);
create index trading_accounts_plan_idx on public.trading_accounts(plan_key);

-- Orders, positions, trades
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  account_id uuid not null references public.trading_accounts(id) on delete cascade,
  instrument text not null,
  segment text not null check (segment in ('EQ','FUT','CE','PE')),
  underlying text not null,
  strike numeric(12,2),
  expiry date,
  side text not null check (side in ('Buy','Sell')),
  order_type text not null check (order_type in ('Market','Limit','Stop')),
  qty bigint not null check (qty > 0),
  price numeric(14,2),
  status text not null default 'pending' check (status in ('pending','filled','cancelled','rejected')),
  reject_reason text,
  created_at timestamptz not null default now(),
  filled_at timestamptz
);
create index orders_user_idx on public.orders(user_id);
create index orders_account_idx on public.orders(account_id, status);

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  account_id uuid not null references public.trading_accounts(id) on delete cascade,
  instrument text not null,
  segment text not null check (segment in ('EQ','FUT','CE','PE')),
  side text not null check (side in ('Buy','Sell')),
  qty bigint not null check (qty > 0),
  avg_price numeric(14,2) not null,
  opened_at timestamptz not null default now(),
  unique (account_id, instrument)
);
create index positions_user_idx on public.positions(user_id);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  account_id uuid not null references public.trading_accounts(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  instrument text not null,
  side text not null check (side in ('Buy','Sell')),
  qty bigint not null check (qty > 0),
  price numeric(14,2) not null,
  realized_pnl numeric(14,2) not null default 0,
  executed_at timestamptz not null default now()
);
create index trades_user_idx on public.trades(user_id);
create index trades_account_idx on public.trades(account_id, executed_at desc);
create index trades_order_idx on public.trades(order_id);

create table public.equity_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  account_id uuid not null references public.trading_accounts(id) on delete cascade,
  equity numeric(14,2) not null,
  taken_at timestamptz not null default now()
);
create index equity_user_idx on public.equity_snapshots(user_id);
create index equity_account_idx on public.equity_snapshots(account_id, taken_at desc);

-- Rewards
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  amount_inr numeric(12,2) not null check (amount_inr >= 0),
  split_pct numeric(5,2) not null,
  status text not null default 'requested' check (status in ('requested','approved','paid','rejected')),
  payout_ref text,
  requested_at timestamptz not null default now(),
  paid_at timestamptz
);
create index rewards_user_idx on public.rewards(user_id);
create index rewards_account_idx on public.rewards(account_id);

-- Row level security
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.purchases enable row level security;
alter table public.trading_accounts enable row level security;
alter table public.orders enable row level security;
alter table public.positions enable row level security;
alter table public.trades enable row level security;
alter table public.equity_snapshots enable row level security;
alter table public.rewards enable row level security;

create policy "own profile read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "plans public read" on public.plans for select to anon, authenticated using (active);
create policy "prices public read" on public.plan_prices for select to anon, authenticated using (true);
create policy "own purchases read" on public.purchases for select to authenticated using ((select auth.uid()) = user_id);
create policy "own accounts read" on public.trading_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "own orders read" on public.orders for select to authenticated using ((select auth.uid()) = user_id);
create policy "own positions read" on public.positions for select to authenticated using ((select auth.uid()) = user_id);
create policy "own trades read" on public.trades for select to authenticated using ((select auth.uid()) = user_id);
create policy "own equity read" on public.equity_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rewards read" on public.rewards for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.plans, public.plan_prices, public.purchases, public.trading_accounts,
  public.orders, public.positions, public.trades, public.equity_snapshots, public.rewards from anon, authenticated;
revoke insert, delete on public.profiles from anon, authenticated;
revoke all on public.profiles from anon;

alter publication supabase_realtime add table public.orders, public.positions, public.trading_accounts;
