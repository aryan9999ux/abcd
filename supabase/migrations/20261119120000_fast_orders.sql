-- Fast order path: one call to read everything an order needs, one call to write a whole fill atomically.
-- Also adds the stop-loss warning counter.
alter table public.trading_accounts add column if not exists no_sl_warnings integer not null default 0;

create or replace function public.order_context(p_account uuid, p_user uuid, p_day_start timestamptz, p_since timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'account', (select to_jsonb(a) from public.trading_accounts a where a.id = p_account and a.user_id = p_user),
    'positions', coalesce((select jsonb_agg(to_jsonb(p)) from public.positions p where p.account_id = p_account), '[]'::jsonb),
    'pending_count', (select count(*) from public.orders o where o.account_id = p_account and o.status = 'pending'),
    'under_review', exists (select 1 from public.rewards r where r.account_id = p_account and r.status = 'requested'),
    'today', coalesce((select jsonb_agg(jsonb_build_object('underlying', o.underlying, 'segment', o.segment, 'side', o.side, 'risk_inr', o.risk_inr))
      from public.orders o where o.account_id = p_account and o.status = 'filled' and o.risk_inr is not null and o.filled_at >= p_day_start), '[]'::jsonb),
    'past', coalesce((select jsonb_agg(x.risk_inr) from (select o.risk_inr from public.orders o where o.account_id = p_account and o.status = 'filled'
      and o.risk_inr is not null and o.filled_at >= p_since order by o.filled_at desc limit 300) x), '[]'::jsonb)
  );
$$;

create or replace function public.apply_fill(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_acct uuid := (p->>'account_id')::uuid;
  v_user uuid := (p->>'user_id')::uuid;
  v_order uuid := (p->>'order_id')::uuid;
  v_realized numeric := coalesce((p->>'realized')::numeric, 0);
begin
  if coalesce((p->>'order_exists')::boolean, false) then
    update public.orders set status = 'filled', filled_at = (p->>'filled_at')::timestamptz where id = v_order;
  else
    insert into public.orders (id, user_id, account_id, instrument, segment, underlying, strike, expiry, side, order_type, qty, price, status, filled_at, stop_loss, risk_inr)
    values (v_order, v_user, v_acct, p->>'instrument', p->>'segment', p->>'underlying', nullif(p->>'strike', '')::numeric, nullif(p->>'expiry', '')::date,
      p->>'side', p->>'order_type', (p->>'qty')::bigint, (p->>'price')::numeric, 'filled', (p->>'filled_at')::timestamptz,
      nullif(p->>'stop_loss', '')::numeric, nullif(p->>'risk', '')::numeric);
  end if;

  insert into public.trades (user_id, account_id, order_id, instrument, side, qty, price, realized_pnl)
  values (v_user, v_acct, v_order, p->>'instrument', p->>'side', (p->>'qty')::bigint, (p->>'price')::numeric, v_realized);

  if p->>'pos_action' = 'update' then
    update public.positions set side = p->>'pos_side', qty = (p->>'pos_qty')::bigint, avg_price = (p->>'pos_avg')::numeric,
      stop_loss = nullif(p->>'pos_stop', '')::numeric where id = (p->>'pos_id')::uuid;
  elsif p->>'pos_action' = 'delete' then
    delete from public.positions where id = (p->>'pos_id')::uuid;
  elsif p->>'pos_action' = 'insert' then
    insert into public.positions (id, user_id, account_id, instrument, segment, side, qty, avg_price, stop_loss, opened_at)
    values ((p->>'pos_id')::uuid, v_user, v_acct, p->>'instrument', p->>'segment', p->>'pos_side', (p->>'pos_qty')::bigint,
      (p->>'pos_avg')::numeric, nullif(p->>'pos_stop', '')::numeric, (p->>'filled_at')::timestamptz);
  end if;

  update public.trading_accounts set balance = (p->>'balance')::numeric, trading_days = (p->>'trading_days')::int,
    last_trading_date = (p->>'last_date')::date, cycle_start_date = (p->>'cycle_start')::date where id = v_acct;

  if v_realized <> 0 then
    insert into public.day_results (account_id, cycle_no, day, pnl) values (v_acct, (p->>'cycle_no')::int, (p->>'day')::date, round(v_realized, 2))
    on conflict (account_id, cycle_no, day) do update set pnl = round(public.day_results.pnl + excluded.pnl, 2);
  end if;
end $$;

revoke all on function public.order_context(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_fill(jsonb) from public, anon, authenticated;
grant execute on function public.order_context(uuid, uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.apply_fill(jsonb) to service_role;
