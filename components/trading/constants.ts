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

const LABELS: Record<string, string> = { NIFTY: "Nifty", BANKNIFTY: "Bank Nifty", SENSEX: "Sensex", FINNIFTY: "Fin Nifty", MIDCPNIFTY: "Midcap Nifty", RELIANCE: "Reliance", TCS: "TCS", HDFCBANK: "HDFC Bank", INFY: "Infosys", SBIN: "SBI" };
/** Plain-case display name for a symbol (the exchange symbol stays upper-case in data). */
export const labelOf = (sym: string) => LABELS[sym] ?? sym;
/** Header/ticker name for the three indices, as brokers write them. */
export const headlineOf = (sym: string) => (sym === "NIFTY" ? "Nifty 50" : labelOf(sym));

export const SYMBOLS = WATCHLIST.map((w) => w.k);
export const isIndexFO = (u: string) => WATCHLIST.find((w) => w.k === u)?.fo ?? false;

export const STOCK_LEVERAGE = 5;
export const POLL_QUOTES_MS = 1000;
export const POLL_DATA_MS = 5000;
