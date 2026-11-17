import { BRAND } from "@/lib/brand";

const BARS = [
  "M9 5h21l-5.5 5.5H9z",
  "M10 13.5h16l-4.5 4.5H10z",
  "M13.5 21h10l-6 6H7.5z",
];

/** The Edge Funded mark: an E built from angled bars, so it reads as an edge and as upward movement. */
export function LogoMark({ size = 28, tile = false, id = "lm" }: { size?: number; tile?: boolean; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c4adff" /><stop offset=".55" stopColor="#8b5cf6" /><stop offset="1" stopColor="#5b2fe0" /></linearGradient>
      </defs>
      {tile && <rect width="32" height="32" rx="9" fill="#120c24" stroke="#6d3df0" strokeOpacity=".55" />}
      <g transform={tile ? "translate(3.2 3.2) scale(.8)" : undefined} fill={`url(#${id}g)`}>
        <path d="M2 28V11.5L8 5.5V22z" />
        {BARS.map((d) => <path key={d} d={d} />)}
      </g>
    </svg>
  );
}

/** "Edge" in the text colour, "Funded" in violet, one brand. */
export function Wordmark() {
  return <span className="wordmark">{BRAND.first} <b>{BRAND.second}</b></span>;
}
