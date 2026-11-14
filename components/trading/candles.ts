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
