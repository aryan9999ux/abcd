import "server-only";
import type { PriceSource, Tick } from "./source";
import { fetchLtp, kiteSession, noteError, noteOk } from "./kite";

/**
 * Zerodha Kite Connect price source. Polls the LTP endpoint about once a second for all symbols in one call,
 * which fits the Connect plan and Kite's rate limit. Does nothing until the admin has connected today.
 *
 * Kite's terms restrict redistribution and public display of live data and list mock-trading apps as a
 * prohibited use. Zerodha can revoke access. Everything depends only on the PriceSource interface.
 */
const POLL_MS = 1200;

export class ZerodhaSource implements PriceSource {
  readonly name = "zerodha";
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;

  subscribe(symbols: string[], onTick: (t: Tick) => void): void {
    const poll = async () => {
      if (this.busy || !kiteSession()) return;
      this.busy = true;
      try {
        const prices = await fetchLtp(symbols);
        const ts = Date.now();
        for (const [symbol, ltp] of Object.entries(prices)) onTick({ symbol, ltp, ts });
        noteOk();
      } catch (e) {
        noteError(e instanceof Error ? e.message : String(e));
      } finally {
        this.busy = false;
      }
    };
    this.timer = setInterval(() => void poll(), POLL_MS);
    this.timer.unref?.();
    void poll();
  }

  close(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
