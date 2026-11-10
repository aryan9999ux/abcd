import type { PriceSource, Tick } from "./source";

/**
 * Zerodha Kite Connect adapter (not wired yet).
 *
 * Constraints from Kite Connect's terms and WebSocket docs:
 *  - max 3 WebSocket connections per API key, 3000 instruments per connection
 *  - live data must not be displayed to the public, cached for redistribution or sublicensed
 *  - virtual / mock trading apps are listed as a prohibited use
 * Zerodha may revoke access. Keep everything behind PriceSource so the vendor can change.
 *
 * Plan: one server-side connection fans ticks out to our own engine; browsers never hold the API key.
 * Needs KITE_API_KEY, KITE_API_SECRET and a daily access token from the Kite login flow.
 */
export class ZerodhaSource implements PriceSource {
  readonly name = "zerodha";

  subscribe(_symbols: string[], _onTick: (t: Tick) => void): void {
    if (!process.env.KITE_API_KEY || !process.env.KITE_API_SECRET) {
      throw new Error("KITE_API_KEY and KITE_API_SECRET are required for PRICE_SOURCE=zerodha");
    }
    throw new Error("Zerodha ticker is not implemented yet");
  }

  close(): void {}
}
