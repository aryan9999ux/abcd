import type { ReactNode } from "react";

type Kind = "list" | "pos" | "trade" | "chain";

function Art({ kind }: { kind: Kind }) {
  // Layered "ghost" cards with a faint chart line: reads as a preview of what will appear here.
  return (
    <svg className="tr-es-art" viewBox="0 0 220 150" fill="none" aria-hidden>
      <defs>
        <linearGradient id="esg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".55" /><stop offset="1" stopColor="var(--accent)" stopOpacity=".08" /></linearGradient>
        <radialGradient id="esb" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="var(--accent)" stopOpacity=".35" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="110" cy="76" rx="105" ry="66" fill="url(#esb)" />
      <rect x="38" y="26" width="144" height="86" rx="14" fill="url(#esg)" opacity=".35" transform="rotate(-6 110 69)" />
      <rect x="30" y="32" width="160" height="90" rx="14" fill="var(--surface)" stroke="var(--line)" />
      <rect x="44" y="46" width="52" height="7" rx="3.5" fill="var(--line)" />
      <rect x="44" y="60" width="34" height="5" rx="2.5" fill="var(--line)" opacity=".6" />
      {kind === "chain"
        ? <path d="M44 84h132M44 96h132M44 108h132M110 74v44" stroke="var(--line)" strokeWidth="1.5" />
        : <path d="M44 106l22-14 18 8 26-22 20 10 26-24 20-4" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}
      <circle cx="176" cy="42" r="9" fill="var(--accent)" opacity=".9" />
      <path d="M172 42h8M176 38v8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Empty/loading state. `full` = a roomy screen with artwork and a getting-started list; default is a compact block. */
export function EmptyState({ icon = "list", title, hint, action, compact, full, steps }: {
  icon?: Kind;
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
  full?: boolean;
  steps?: string[];
}) {
  return (
    <div className={`tr-es${compact ? " compact" : ""}${full ? " full" : ""}`} role="status">
      {full || !compact ? <Art kind={icon} /> : (
        <svg className="tr-es-ic" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="4" y="5" width="16" height="14" rx="2.5" /><path d="M8 10h8M8 14h5" />
        </svg>
      )}
      <b>{title}</b>
      {hint && <p>{hint}</p>}
      {action && <div className="tr-es-act">{action}</div>}
      {steps && (
        <ol className="tr-es-steps">
          {steps.map((s, i) => <li key={i}><i>{i + 1}</i><span>{s}</span></li>)}
        </ol>
      )}
    </div>
  );
}
