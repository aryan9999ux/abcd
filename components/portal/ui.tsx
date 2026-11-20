import type { ReactNode } from "react";

const P: Record<string, string> = {
  overview: "M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z",
  accounts: "M3 7h18v12H3zM3 7l2-3h14l2 3M16 13h2",
  payouts: "M12 3v14m0 0-5-5m5 5 5-5M5 21h14",
  verify: "M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM9 12l2 2 4-4",
  terminal: "M3 17l5-6 4 4 8-9M15 6h5v5",
  plus: "M12 5v14M5 12h14",
  chevron: "M9 6l6 6-6 6",
  check: "M5 12l5 5 9-10",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  out: "M9 4H5v16h4M16 8l4 4-4 4M20 12H9",
  clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17v.01",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
};

export function Icon({ n, size = 20 }: { n: keyof typeof P | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[n] ?? ""} />
    </svg>
  );
}

export function Bar({ value, tone = "ok", label }: { value: number; tone?: "ok" | "risk" | "brand"; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const t = tone === "risk" ? (v > 80 ? "bad" : v > 55 ? "warn" : "ok") : tone;
  return <div className="pt-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}><i className={t} style={{ width: `${v}%` }} /></div>;
}

export function Badge({ tone = "n", children }: { tone?: "n" | "ok" | "warn" | "bad" | "brand"; children: ReactNode }) {
  return <span className={"pt-badge " + tone}>{children}</span>;
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="pt-head">
      <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {actions && <div className="pt-acts">{actions}</div>}
    </div>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="pt-kpi">
      <small>{label}</small>
      <b className={tone ?? ""}>{value}</b>
      {sub && <span>{sub}</span>}
    </div>
  );
}
