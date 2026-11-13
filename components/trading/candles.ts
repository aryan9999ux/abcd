import type { Candle } from "./types";

const MIN = 60_000;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Demo-only backfill of 1-minute candles that ends exactly at the current spot.
 * Only used when the price source is "demo". Live sources build candles from ticks alone,
 * because vendor terms do not allow storing or replaying their history.
 */
export function seedDemoCandles(spot: number, seed: number, n = 600, now = Date.now()): Candle[] {
  const r = rng(seed);
  const raw: Candle[] = [];
  let p = spot;
  const end = Math.floor(now / MIN) * MIN;
  for (let i = 0; i < n; i++) {
    const o = p;
    let h = o, l = o, x = o;
    for (let k = 0; k < 6; k++) {
      x *= 1 + (r() - 0.5) * 0.0011;
      h = Math.max(h, x);
      l = Math.min(l, x);
    }
    raw.push({ t: end - (n - 1 - i) * MIN, o, h, l, c: x });
    p = x;
  }
  const k = spot / raw[raw.length - 1].c;
  return raw.map((c) => ({ t: c.t, o: c.o * k, h: c.h * k, l: c.l * k, c: c.c * k }));
}

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
