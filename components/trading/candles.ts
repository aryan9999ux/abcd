import type { Candle } from "./types";

const MIN = 60_000;

/** Fold a tick into the 1-minute series. Returns a new array only when a minute rolls over. */
export function pushTick(series: Candle[], ltp: number, ts: number): Candle[] {
  const bucket = Math.floor(ts / MIN) * MIN;
  const last = series[series.length - 1];
  if (last && last.t === bucket) {
    last.c = ltp;
    if (ltp > last.h) last.h = ltp;
    if (ltp < last.l) last.l = ltp;
    return series;
  }
  const next = [...series, { t: bucket, o: last ? last.c : ltp, h: ltp, l: ltp, c: ltp }];
  return next.length > 1500 ? next.slice(next.length - 1500) : next;
}

/** Roll 1-minute candles up to m-minute candles aligned to the clock. */
export function aggregate(series: Candle[], m: number): Candle[] {
  if (m <= 1) return series;
  const out: Candle[] = [];
  const size = m * MIN;
  for (const c of series) {
    const b = Math.floor(c.t / size) * size;
    const last = out[out.length - 1];
    if (last && last.t === b) {
      last.h = Math.max(last.h, c.h);
      last.l = Math.min(last.l, c.l);
      last.c = c.c;
    } else out.push({ t: b, o: c.o, h: c.h, l: c.l, c: c.c });
  }
  return out;
}

/** Real exchange candles with the live price folded into the current bar. Never invents a bar. */
export function mergeLive(hist: Candle[], live: Candle[], tfMin: number): Candle[] {
  const out = hist.map((c) => ({ ...c }));
  const size = tfMin * MIN;
  if (tfMin >= 1440) {
    // Daily bars: fold the live price into today's bar only (bars are dated at the IST midnight).
    const last = out[out.length - 1], l = live[live.length - 1];
    const today = (t: number) => new Date(t + 330 * MIN).toISOString().slice(0, 10);
    if (last && l && today(last.t) === today(l.t)) { last.c = l.c; last.h = Math.max(last.h, l.h); last.l = Math.min(last.l, l.l); }
    return out;
  }
  for (const c of aggregate(live.map((x) => ({ ...x })), tfMin)) {
    const last = out[out.length - 1];
    if (last && c.t < last.t) continue;
    if (last && last.t === c.t) {
      last.h = Math.max(last.h, c.h);
      last.l = Math.min(last.l, c.l);
      last.c = c.c;
    } else if (!last || c.t >= last.t + size) out.push(c);
  }
  return out;
}

/** Replace or add bars by time, keeping the series sorted. Used to fold a small refresh into the full history. */
export function mergeByTime(base: Candle[], fresh: Candle[]): Candle[] {
  if (!fresh.length) return base;
  const map = new Map(base.map((c) => [c.t, c]));
  for (const c of fresh) map.set(c.t, c);
  return [...map.values()].sort((a, b) => a.t - b.t);
}
