import "server-only";
import { ensureFeed } from "../market/server-feed";
import { runTick } from "./service";

interface State { timer?: ReturnType<typeof setInterval>; running: boolean; last: number; warnedAt: number }
const g = globalThis as unknown as { __propEngine?: State };
const state: State = (g.__propEngine ??= { running: false, last: 0, warnedAt: 0 });

/** One pass of the tick job. Never throws; a missing service key is logged at most once a minute. */
export async function tickOnce(): Promise<{ ok: boolean; accounts?: number; error?: string }> {
  if (state.running) return { ok: true };
  state.running = true;
  try {
    const r = await runTick();
    return { ok: true, accounts: r.accounts };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (Date.now() - state.warnedAt > 60_000) {
      state.warnedAt = Date.now();
      console.error("[engine] tick failed:", msg);
    }
    return { ok: false, error: msg };
  } finally {
    state.running = false;
    state.last = Date.now();
  }
}

/** Start the price feed and the 2-second tick job (idempotent). Called lazily from the API routes. */
export function ensureEngine() {
  ensureFeed();
  if (!state.timer) {
    state.timer = setInterval(() => void tickOnce(), 2000);
    state.timer.unref?.();
  }
}

/** Opportunistic tick after a request, throttled to one per second. */
export function kick() {
  ensureEngine();
  if (Date.now() - state.last > 1000) void tickOnce();
}
