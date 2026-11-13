"use client";
import { useEffect } from "react";

function current(): "dark" | "light" {
  const r = document.documentElement;
  return (r.dataset.theme as "dark" | "light" | undefined) ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
}

export default function ThemeToggle() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") document.documentElement.dataset.theme = saved;
    } catch {
      /* storage unavailable */
    }
  }, []);

  return (
    <button
      className="iconbtn"
      aria-label="Toggle light or dark theme"
      title="Theme"
      onClick={() => {
        const next = current() === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("theme", next);
        } catch {
          /* storage unavailable */
        }
        window.dispatchEvent(new Event("themechange"));
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
