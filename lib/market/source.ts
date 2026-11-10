/**
 * Price-source interface. The terminal and trading engine depend only on this,
 * so the data vendor (Zerodha today, a licensed vendor later) can be swapped in one place.
 */
export type Tick = { symbol: string; ltp: number; ts: number };

export interface PriceSource {
  readonly name: string;
  subscribe(symbols: string[], onTick: (t: Tick) => void): void;
  close(): void;
}

export function createPriceSource(): PriceSource {
  switch (process.env.PRICE_SOURCE) {
    case "zerodha": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ZerodhaSource } = require("./zerodha");
      return new ZerodhaSource();
    }
    default: {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DemoSource } = require("./demo");
      return new DemoSource();
    }
  }
}
