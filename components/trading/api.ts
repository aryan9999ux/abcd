import type { ApiResult, OrderType, Side } from "@/lib/types";

/** POST JSON to the engine API. Never throws: network and server failures come back as { ok: false }. */
export async function postJSON<T extends object = object>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    if (res.status === 401) return { ok: false, error: "Your session has expired. Log in again." };
    const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (!json) return { ok: false, error: "The server sent an unexpected response. Try again." };
    return json;
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }
}

/** Decide the order type for a click on the chart at `price`. Near the market price it is a market order. */
export function orderTypeAt(side: Side, price: number, ltp: number): { orderType: OrderType; price?: number } {
  if (Math.abs(price - ltp) / ltp < 0.0004) return { orderType: "Market" };
  if (side === "Buy") return { orderType: price < ltp ? "Limit" : "Stop", price };
  return { orderType: price > ltp ? "Limit" : "Stop", price };
}
