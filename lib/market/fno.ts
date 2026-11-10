/**
 * F&O contract configuration.
 * Lot sizes and expiry rules change by exchange circular (lot sizes are reviewed about every six months).
 * Verify against NSE / BSE before launch. Source checked 10 Nov 2026.
 */
export const INDEX_CONTRACTS = {
  NIFTY: { exchange: "NSE", lot: 65, strikeStep: 50, expiry: "weekly-tuesday" },
  BANKNIFTY: { exchange: "NSE", lot: 30, strikeStep: 100, expiry: "monthly" },
  SENSEX: { exchange: "BSE", lot: 20, strikeStep: 100, expiry: "weekly-thursday" },
} as const;

/** Cash-segment stocks get this intraday leverage on the simulated account. */
export const STOCK_LEVERAGE = 5;
/** Sample margin model for futures and short options. Replace with the real SPAN-style rule. */
export const FNO_MARGIN_RATE = 0.12;
