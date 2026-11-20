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
      </svg>
      <div className="pt-art-chip c1"><b>80%</b><span>profit split</span></div>
      <div className="pt-art-chip c2"><b>₹10L</b><span>capital to trade</span></div>
      <div className="pt-art-chip c3"><b>14 days</b><span>payout cycle</span></div>
    </div>
  );
}
