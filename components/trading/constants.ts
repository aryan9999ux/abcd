export interface WatchItem {
  k: string;
  n: string;
  fo: boolean;
}

/** Watchlist. Index F&O first, then cash stocks that get 5x intraday leverage. */
export const WATCHLIST: WatchItem[] = [
  { k: "NIFTY", n: "Nifty 50", fo: true },
  { k: "BANKNIFTY", n: "Bank Nifty", fo: true },
  { k: "SENSEX", n: "Sensex", fo: true },
  { k: "RELIANCE", n: "Reliance Industries", fo: false },
  { k: "TCS", n: "Tata Consultancy", fo: false },
  { k: "HDFCBANK", n: "HDFC Bank", fo: false },
  { k: "INFY", n: "Infosys", fo: false },
  { k: "SBIN", n: "State Bank of India", fo: false },
];

export const SYMBOLS = WATCHLIST.map((w) => w.k);
export const isIndexFO = (u: string) => WATCHLIST.find((w) => w.k === u)?.fo ?? false;

export const STOCK_LEVERAGE = 5;
export const POLL_QUOTES_MS = 1000;
export const POLL_DATA_MS = 5000;
