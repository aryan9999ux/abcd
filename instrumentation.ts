/** Starts the price feed and the 2-second engine job when the server boots, so loss limits and pending
 *  orders are enforced even when nobody has the site open. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureEngine } = await import("./lib/engine/runtime");
    ensureEngine();
  }
}
