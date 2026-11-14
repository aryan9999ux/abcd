import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/engine/admin";
import { HttpError } from "@/lib/engine/http";
import { ensureEngine } from "@/lib/engine/runtime";
import { feedStats } from "@/lib/market/server-feed";
import { contractsReady } from "@/lib/market/instruments";
import { kiteStatus, restoreSession } from "@/lib/market/kite";

export const dynamic = "force-dynamic";
export const metadata = { title: "Zerodha connection" };

const fmt = (t: number | null) =>
  t ? new Date(t).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" }) + " IST" : "never";

export default async function ZerodhaAdmin({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/login?next=/admin/zerodha");
    return (
      <main className="wrap" style={{ paddingBlock: 48 }}>
        <div className="glass" style={{ padding: 28, maxWidth: 560 }}>
          <h2>Admins only</h2>
          <p className="muted" style={{ marginTop: 10 }}>Sign in with the admin account to manage the Zerodha connection.</p>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  ensureEngine();
  await restoreSession();
  const k = kiteStatus();
  const f = feedStats();
  const modeOk = f.source === "zerodha";
  const connected = !!k.session;
  const live = f.live && f.liveSymbols > 0;

  return (
    <main className="wrap view" style={{ paddingBlock: 48 }}>
      <span className="eyebrow">Admin</span>
      <h1 style={{ fontSize: "clamp(1.8rem,4vw,2.6rem)", marginTop: 8 }}>Zerodha connection</h1>
      <p className="muted" style={{ marginTop: 10, maxWidth: 620 }}>
        Live prices come from Zerodha. The login lasts until about 6 AM IST, so connect once every trading morning.
      </p>

      {sp.connected && <div className="glass" style={{ padding: 14, marginTop: 20 }}><span className="pill up">Connected</span> Zerodha login completed.</div>}
      {sp.error && <div className="glass" style={{ padding: 14, marginTop: 20 }}><span className="pill warn">Could not connect</span> {sp.error}</div>}

      <div className="glass" style={{ padding: 24, marginTop: 20, display: "grid", gap: 14, maxWidth: 720 }}>
        <Row k="Price source in use" v={<span className={"pill " + (modeOk ? "up" : "warn")}>{f.source}</span>} />
        {!modeOk && <p className="muted" style={{ fontSize: ".85rem" }}>This server is on demo prices (local development only). A production server always uses Zerodha.</p>}
        <Row k="Contract list" v={contractsReady() ? <span className="pill up">Loaded from the exchange</span> : <span className="pill warn">Not loaded</span>} />
        <Row k="Contracts being priced" v={String(f.watched)} />
        <Row k="Zerodha keys on server" v={k.configured ? "Set" : "Missing"} />
        <Row k="Login" v={connected ? <span className="pill up">Connected as {k.session!.userName}</span> : <span className="pill warn">Not connected</span>} />
        <Row k="Connected at" v={fmt(k.session?.connectedAt ?? null)} />
        <Row k="Login expires" v={fmt(k.expiresAt)} />
        <Row k="Live prices" v={live ? `${f.liveSymbols} of ${f.symbols} symbols` : "none"} />
        <Row k="Last price update" v={fmt(k.lastOkAt)} />
        {k.lastError && <Row k="Last error" v={k.lastError} />}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
          <a className="btn primary" href="/api/zerodha/login">{connected ? "Reconnect Zerodha" : "Connect Zerodha"}</a>
          <a className="btn" href="/admin/zerodha">Refresh status</a>
        </div>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
      <span className="muted">{k}</span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
    </div>
  );
}
