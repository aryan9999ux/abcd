/**
 * F&O product configuration. Which index underlyings are offered is a product choice.
 * Lot sizes, expiries and strikes are NOT stored here: they come from the exchange contract list at runtime.
 */
export const INDEX_CONTRACTS = {
  NIFTY: { exchange: "NSE" },
  BANKNIFTY: { exchange: "NSE" },
  SENSEX: { exchange: "BSE" },
} as const;

/** Cash-segment stocks get this intraday leverage on the simulated account. */
export const STOCK_LEVERAGE = 5;
/** Sample margin model for futures and short options. Replace with the real SPAN-style rule. */
export const FNO_MARGIN_RATE = 0.12;
