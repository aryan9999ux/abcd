"use client";
import { useEffect } from "react";

/** Page-wide motion: reveal-on-scroll for [data-reveal] blocks and a cursor spotlight on .spot cards. Renders nothing. */
export default function Motion() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let io: IntersectionObserver | undefined;
    if (!reduce && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) if (e.isIntersecting) { (e.target as HTMLElement).classList.add("in"); io?.unobserve(e.target); }
        },
        { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
      );
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return; // already on screen: leave visible
        el.classList.add("rv");
        io!.observe(el);
      });
    }
    const move = (e: PointerEvent) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>(".spot");
      if (!t) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty("--mx", `${e.clientX - r.left}px`);
      t.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => { io?.disconnect(); document.removeEventListener("pointermove", move); };
  }, []);
  return null;
}
