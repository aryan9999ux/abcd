/** Bold up/down arrow beside a price change (green when up, red when down via currentColor). */
export function Arrow({ up }: { up: boolean }) {
  return (
    <svg className="tr-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {up ? <path d="M4 12L12 4M5.5 4H12v6.5" /> : <path d="M4 4l8 8M5.5 12H12V5.5" />}
    </svg>
  );
}
