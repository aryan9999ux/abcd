import type { ReactNode } from "react";

/** Centered empty/loading state: icon, one-line title, helper text, optional action. */
export function EmptyState({ icon = "list", title, hint, action, compact }: {
  icon?: "list" | "pos" | "trade" | "chain";
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`tr-es${compact ? " compact" : ""}`} role="status">
      <svg className="tr-es-ic" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {icon === "list" && <><rect x="4" y="5" width="16" height="14" rx="2.5" /><path d="M8 10h8M8 14h5" /></>}
        {icon === "pos" && <><path d="M4 17l5-5 4 3 7-8" /><path d="M15 7h5v5" /></>}
        {icon === "trade" && <><path d="M7 4v16M7 8h-2v6h2M17 4v16M17 9h-2v7h2" /></>}
        {icon === "chain" && <><path d="M4 7h16M4 12h16M4 17h16M12 4v16" /></>}
      </svg>
      <b>{title}</b>
      {hint && <p>{hint}</p>}
      {action && <div className="tr-es-act">{action}</div>}
    </div>
  );
}
