"use client";
import { useEffect, useState } from "react";

const IST = 5.5 * 3600 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

/** Real time to the next NSE open (Mon-Fri 9:15 IST), or to the close while open. Holidays are not known. */
function state(now: number) {
  const t = new Date(now + IST); // read with getUTC* = IST wall clock
  const day = t.getUTCDay(), mins = t.getUTCHours() * 60 + t.getUTCMinutes();
  const secs = t.getUTCSeconds();
  const weekday = day >= 1 && day <= 5;
  const toMs = (m: number) => (m * 60 - secs) * 1000;
  if (weekday && mins >= 555 && mins < 930) return { open: true, ms: toMs(930 - mins) };
  let add = 0;
  if (weekday && mins < 555) add = 0;
  else { add = 1; let d = (day + 1) % 7; while (d === 0 || d === 6) { add++; d = (d + 1) % 7; } }
  return { open: false, ms: add * 86400000 + toMs(555 - mins) };
}

export default function Countdown({ className = "" }: { className?: string }) {
  const [s, setS] = useState<{ open: boolean; ms: number } | null>(null);
  useEffect(() => { const f = () => setS(state(Date.now())); f(); const id = setInterval(f, 1000); return () => clearInterval(id); }, []);
  if (!s) return <span className={className}>Opens 9:15 AM IST</span>;
  const tot = Math.max(0, Math.floor(s.ms / 1000)), d = Math.floor(tot / 86400), h = Math.floor((tot % 86400) / 3600), m = Math.floor((tot % 3600) / 60), sec = tot % 60;
  const clock = d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return (
    <span className={className}>
      <i className={`cd-dot${s.open ? " on" : ""}`} />
      {s.open ? "Market is open · closes in" : "Market opens in"} <b className="cd-t">{clock}</b>
    </span>
  );
}
