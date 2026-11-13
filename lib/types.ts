export type Segment = "EQ" | "FUT" | "CE" | "PE";
export type Side = "Buy" | "Sell";
export type OrderType = "Market" | "Limit" | "Stop";

/** expiry is YYYY-MM-DD. strike only for CE/PE. expiry for FUT/CE/PE. EQ has neither. */
export interface InstrumentRef {
  underlying: string; // NIFTY, BANKNIFTY, SENSEX, RELIANCE, ...
  segment: Segment;
  strike?: number;
  expiry?: string;
}

/** Value stored in the database `instrument` text column. */
export function instrumentKey(r: InstrumentRef): string {
  return [r.underlying, r.segment, r.strike ?? "", r.expiry ?? ""].join("|");
}

export function parseInstrumentKey(key: string): InstrumentRef {
  const [underlying, segment, strike, expiry] = key.split("|");
  return {
    underlying,
    segment: segment as Segment,
    strike: strike ? Number(strike) : undefined,
    expiry: expiry || undefined,
  };
}

/** qty is always in UNITS (lots * lot size for F&O, shares for stocks). */
export interface PlaceOrderRequest extends InstrumentRef {
  accountId: string;
  side: Side;
  orderType: OrderType;
  qty: number;
  /** Required for Limit and Stop. Ignored for Market. */
  price?: number;
}

export interface CancelOrderRequest { accountId: string; orderId: string }
export interface CloseAllRequest { accountId: string }
export interface ClosePositionRequest { accountId: string; instrument: string }

export type ApiResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

/** GET /api/quotes?symbols=NIFTY,BANKNIFTY  ->  spot LTP per underlying. Server-authoritative. */
export interface QuotesResponse {
  ts: number;
  source: string; // "demo" | "zerodha"
  quotes: Record<string, number>;
}

/** POST /api/checkout. Dev mode marks the purchase paid immediately and creates the trading account. */
export interface CheckoutRequest { planKey: string; accountSize: number }
export interface CheckoutResponse { purchaseId: string; accountId: string }
