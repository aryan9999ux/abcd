-- Super orders: a target price next to the stop loss, on orders and on open positions.
alter table public.positions add column if not exists take_profit numeric;
alter table public.orders add column if not exists take_profit numeric;

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
    insert into public.orders (id, user_id, account_id, instrument, segment, underlying, strike, expiry, side, order_type, qty, price, status, filled_at, stop_loss, risk_inr, take_profit)
    values (v_order, v_user, v_acct, p->>'instrument', p->>'segment', p->>'underlying', nullif(p->>'strike', '')::numeric, nullif(p->>'expiry', '')::date,
      p->>'side', p->>'order_type', (p->>'qty')::bigint, (p->>'price')::numeric, 'filled', (p->>'filled_at')::timestamptz,
      nullif(p->>'stop_loss', '')::numeric, nullif(p->>'risk', '')::numeric, nullif(p->>'take_profit', '')::numeric);
  end if;

  insert into public.trades (user_id, account_id, order_id, instrument, side, qty, price, realized_pnl)
  values (v_user, v_acct, v_order, p->>'instrument', p->>'side', (p->>'qty')::bigint, (p->>'price')::numeric, v_realized);

  if p->>'pos_action' = 'update' then
    update public.positions set side = p->>'pos_side', qty = (p->>'pos_qty')::bigint, avg_price = (p->>'pos_avg')::numeric,
      stop_loss = nullif(p->>'pos_stop', '')::numeric, take_profit = nullif(p->>'pos_target', '')::numeric where id = (p->>'pos_id')::uuid;
  elsif p->>'pos_action' = 'delete' then
    delete from public.positions where id = (p->>'pos_id')::uuid;
  elsif p->>'pos_action' = 'insert' then
    insert into public.positions (id, user_id, account_id, instrument, segment, side, qty, avg_price, stop_loss, take_profit, opened_at)
    values ((p->>'pos_id')::uuid, v_user, v_acct, p->>'instrument', p->>'segment', p->>'pos_side', (p->>'pos_qty')::bigint,
      (p->>'pos_avg')::numeric, nullif(p->>'pos_stop', '')::numeric, nullif(p->>'pos_target', '')::numeric, (p->>'filled_at')::timestamptz);
  end if;

  update public.trading_accounts set balance = (p->>'balance')::numeric, trading_days = (p->>'trading_days')::int,
    last_trading_date = (p->>'last_date')::date, cycle_start_date = (p->>'cycle_start')::date where id = v_acct;

  if v_realized <> 0 then
    insert into public.day_results (account_id, cycle_no, day, pnl) values (v_acct, (p->>'cycle_no')::int, (p->>'day')::date, round(v_realized, 2))
    on conflict (account_id, cycle_no, day) do update set pnl = round(public.day_results.pnl + excluded.pnl, 2);
  end if;
end $$;

revoke all on function public.apply_fill(jsonb) from public, anon, authenticated;
grant execute on function public.apply_fill(jsonb) to service_role;
