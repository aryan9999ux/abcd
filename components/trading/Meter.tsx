/** Progress bar for a rule. `risk` meters turn amber then red as the limit gets close. */
export function Meter({ label, used, limit, text, risk }: { label: string; used: number; limit: number; text: string; risk?: boolean }) {
  const p = limit > 0 ? Math.max(0, Math.min(100, (used / limit) * 100)) : 0;
  const cls = risk ? (p > 80 ? "bad" : p > 55 ? "risk" : "") : "";
  return (
    <div className="tr-meter">
      <small>
        <span>{label}</span>
        <span className="tr-mono">{text}</span>
      </small>
      <div className="tr-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)}>
        <i className={cls} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
