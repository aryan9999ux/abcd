/**
 * Implied volatility and delta, calculated from the REAL traded premium (Black-Scholes inversion).
 * The exchange feed does not publish greeks, so these are derived from live prices, never from a model price.
 */
const RATE = 0.065;

function ncdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

function bs(type: "CE" | "PE", S: number, K: number, T: number, sig: number) {
  const sq = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (RATE + (sig * sig) / 2) * T) / (sig * sq);
  const d2 = d1 - sig * sq;
  const price = type === "CE" ? S * ncdf(d1) - K * Math.exp(-RATE * T) * ncdf(d2) : K * Math.exp(-RATE * T) * ncdf(-d2) - S * ncdf(-d1);
  return { price, delta: type === "CE" ? ncdf(d1) : ncdf(d1) - 1 };
}

/** Years to the 15:30 IST close on the expiry date. */
export function yearsTo(expiry: string, now: number): number {
  return Math.max((Date.parse(`${expiry}T15:30:00+05:30`) - now) / (365 * 864e5), 1 / 365 / 24);
}

export function greeks(type: "CE" | "PE", spot: number, strike: number, expiry: string, premium: number, now = Date.now()): { iv: number; delta: number } | null {
  const T = yearsTo(expiry, now);
  const intrinsic = type === "CE" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  if (!(premium > 0) || premium <= intrinsic * 0.999) return null; // no time value, IV undefined
  let lo = 0.01, hi = 3;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (bs(type, spot, strike, T, mid).price > premium) hi = mid; else lo = mid;
  }
  const iv = (lo + hi) / 2;
  return { iv, delta: bs(type, spot, strike, T, iv).delta };
}
