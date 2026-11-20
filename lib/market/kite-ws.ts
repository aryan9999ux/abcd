/**
 * Kite Connect streaming (wss://ws.kite.trade). Binary frames: 2-byte packet count, then per packet a
 * 2-byte length and the data. Prices are integers in paise. The parser is pure so it can be tested offline.
 */
export interface WsTick { token: number; ltp: number; close?: number; bid?: number; ask?: number; oi?: number; vol?: number }

/** Divisor by exchange segment (low byte of the token). NSE/BSE/indices use paise. */
function divisor(token: number): number {
  const seg = token & 0xff;
  return seg === 3 ? 1e7 : seg === 6 ? 1e4 : 100;
}

export function parseFrame(buf: ArrayBuffer): WsTick[] {
  const out: WsTick[] = [];
  if (buf.byteLength < 2) return out; // heartbeat is a single byte
  const v = new DataView(buf);
  const n = v.getUint16(0);
  let off = 2;
  for (let i = 0; i < n && off + 2 <= buf.byteLength; i++) {
    const len = v.getUint16(off); off += 2;
    if (off + len > buf.byteLength) break;
    if (len >= 8) {
      const token = v.getInt32(off);
      const d = divisor(token);
      const t: WsTick = { token, ltp: v.getInt32(off + 4) / d };
      if (len === 28 || len === 32) t.close = v.getInt32(off + 20) / d; // index
      else if (len >= 44) {
        t.vol = v.getUint32(off + 16);
        t.close = v.getInt32(off + 40) / d;
        if (len >= 184) {
          t.oi = v.getUint32(off + 48);
          const bid = v.getInt32(off + 68) / d, ask = v.getInt32(off + 128) / d; // first buy / first sell depth price
          if (bid > 0) t.bid = bid;
          if (ask > 0) t.ask = ask;
        }
      }
      if (t.ltp > 0) out.push(t);
    }
    off += len;
  }
  return out;
}

export interface WsHandlers { onTicks(t: WsTick[]): void; onState?(up: boolean): void }

/** Auto-reconnecting stream. `setTokens` is cheap to call often: it only sends the difference. */
export class KiteStream {
  private ws?: WebSocket;
  private want = new Set<number>();
  private sent = new Set<number>();
  private retry = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private closed = false;
  up = false;
  lastFrame = 0;

  constructor(private creds: () => { apiKey: string; accessToken: string } | undefined, private h: WsHandlers) {}

  start() { this.connect(); }
  stop() { this.closed = true; clearTimeout(this.timer); try { this.ws?.close(); } catch { /* already closed */ } }

  setTokens(tokens: number[]) {
    this.want = new Set(tokens);
    this.sync();
  }

  private sync() {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1) return;
    const add = [...this.want].filter((t) => !this.sent.has(t));
    const drop = [...this.sent].filter((t) => !this.want.has(t));
    if (drop.length) { ws.send(JSON.stringify({ a: "unsubscribe", v: drop })); for (const t of drop) this.sent.delete(t); }
    if (add.length) {
      ws.send(JSON.stringify({ a: "subscribe", v: add }));
      ws.send(JSON.stringify({ a: "mode", v: ["full", add] }));
      for (const t of add) this.sent.add(t);
    }
  }

  private connect() {
    if (this.closed) return;
    const c = this.creds();
    if (!c) { this.schedule(); return; }
    try {
      const ws = new WebSocket(`wss://ws.kite.trade?api_key=${encodeURIComponent(c.apiKey)}&access_token=${encodeURIComponent(c.accessToken)}`);
      ws.binaryType = "arraybuffer";
      this.ws = ws;
      ws.onopen = () => { this.retry = 0; this.sent.clear(); this.up = true; this.h.onState?.(true); this.sync(); };
      ws.onmessage = (e) => {
        this.lastFrame = Date.now();
        if (e.data instanceof ArrayBuffer) { const t = parseFrame(e.data); if (t.length) this.h.onTicks(t); }
      };
      const down = () => { if (this.ws !== ws) return; this.ws = undefined; this.sent.clear(); if (this.up) { this.up = false; this.h.onState?.(false); } this.schedule(); };
      ws.onclose = down;
      ws.onerror = down;
    } catch { this.schedule(); }
  }

  private schedule() {
    if (this.closed) return;
    this.retry = Math.min(this.retry + 1, 6);
    this.timer = setTimeout(() => this.connect(), Math.min(1000 * 2 ** this.retry, 30_000));
    this.timer.unref?.();
  }
}
