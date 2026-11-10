import type { PriceSource, Tick } from "./source";

const BASE: Record<string, number> = {
  NIFTY: 24480.35,
  BANKNIFTY: 52310.1,
  SENSEX: 80250.6,
  RELIANCE: 1452.2,
  TCS: 3120.45,
  HDFCBANK: 1001.6,
  INFY: 1612.75,
  SBIN: 842.3,
};

/** Random-walk prices for development. Not real market data. */
export class DemoSource implements PriceSource {
  readonly name = "demo";
  private timer?: ReturnType<typeof setInterval>;
  private last = { ...BASE };

  subscribe(symbols: string[], onTick: (t: Tick) => void) {
    this.timer = setInterval(() => {
      for (const s of symbols) {
        const p = (this.last[s] ?? 100) * (1 + (Math.random() - 0.5) * 0.0011);
        this.last[s] = p;
        onTick({ symbol: s, ltp: p, ts: Date.now() });
      }
    }, 800);
  }

  close() {
    if (this.timer) clearInterval(this.timer);
  }
}
