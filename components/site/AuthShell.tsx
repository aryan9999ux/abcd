import type { ReactNode } from "react";

/** Two-column auth layout: a calm brand panel beside the form. */
export default function AuthShell({ signup, children }: { signup: boolean; children: ReactNode }) {
  return (
    <main className="authx">
      <aside className="authx-art" aria-hidden>
        <div className="grid" />
        <svg viewBox="0 0 400 220" preserveAspectRatio="none">
          <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".3" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
          <path className="f" d="M0 190 50 170 100 178 160 130 210 142 270 90 320 100 400 30 V220 H0Z" fill="url(#ag)" />
          <path className="l" pathLength={1} d="M0 190 50 170 100 178 160 130 210 142 270 90 320 100 400 30" />
        </svg>
        <div className="txt">
          <h2>{signup ? "Trade with a funded account." : "Welcome back to your desk."}</h2>
          <ul>
            <li>Live NSE and BSE prices on every instrument</li>
            <li>Your loss limits are always in view</li>
            <li>Keep 80% of closed profit on a funded account</li>
          </ul>
        </div>
      </aside>
      <div className="authx-form">{children}</div>
    </main>
  );
}
