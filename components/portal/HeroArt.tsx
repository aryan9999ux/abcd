/** Decorative animated equity curve for the welcome hero. Pure SVG + CSS, no data. */
export function HeroArt() {
  const bars = [34, 52, 40, 66, 48, 78, 60, 92, 70, 104, 84, 120];
  return (
    <div className="pt-art" aria-hidden>
      <i className="pt-art-orb" />
      <svg viewBox="0 0 420 260" className="pt-art-svg" fill="none">
        <defs>
          <linearGradient id="haL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#34d399" /></linearGradient>
          <linearGradient id="haA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b5cf6" stopOpacity=".35" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient>
        </defs>
        {[50, 100, 150, 200].map((y) => <line key={y} x1="0" x2="420" y1={y} y2={y} stroke="currentColor" strokeOpacity=".08" />)}
        {bars.map((h, i) => (
          <rect key={i} className="pt-art-bar" style={{ animationDelay: `${i * 0.18}s` }} x={14 + i * 34} y={250 - h} width="14" height={h} rx="4" fill="currentColor" fillOpacity=".09" />
        ))}
        <path className="pt-art-area" d="M0 220 C50 210 70 190 110 196 S170 150 210 158 S270 100 310 108 S370 50 420 36 V260 H0Z" fill="url(#haA)" />
        <path className="pt-art-line" d="M0 220 C50 210 70 190 110 196 S170 150 210 158 S270 100 310 108 S370 50 420 36" stroke="url(#haL)" strokeWidth="3.5" strokeLinecap="round" pathLength="1" />
        <circle className="pt-art-dot" cx="420" cy="36" r="6" fill="#34d399" />
        <g className="pt-art-note n1">
          <line x1="110" y1="190" x2="110" y2="150" stroke="currentColor" strokeOpacity=".35" />
          <circle cx="110" cy="196" r="4.5" className="pt-art-ring" />
          <text x="116" y="136" className="nv">₹10L</text><text x="116" y="152" className="nl">funded capital</text>
        </g>
        <g className="pt-art-note n2">
          <line x1="262" y1="124" x2="262" y2="76" stroke="currentColor" strokeOpacity=".35" />
          <circle cx="262" cy="130" r="4.5" className="pt-art-ring" />
          <text x="256" y="62" textAnchor="end" className="nv">Every 14 days</text><text x="256" y="78" textAnchor="end" className="nl">request a payout</text>
        </g>
        <g className="pt-art-note n3">
          <text x="404" y="14" textAnchor="end" className="nv">80% yours</text><text x="404" y="30" textAnchor="end" className="nl">of every profit</text>
        </g>
      </svg>
    </div>
  );
}
