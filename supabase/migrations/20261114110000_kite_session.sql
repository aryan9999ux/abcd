create table if not exists public.kite_session (
  id int primary key default 1 check (id = 1),
  token_enc text not null,
  user_id text,
  user_name text,
  connected_at timestamptz not null default now()
);
alter table public.kite_session enable row level security;
revoke all on public.kite_session from anon, authenticated;
comment on table public.kite_session is 'Encrypted Zerodha access token so redeploys keep live prices. Service role only; RLS on with no policies.';
