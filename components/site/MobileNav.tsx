"use client";
import { useEffect } from "react";

/** Marks the header once the page scrolls and feeds a scroll value to the parallax. Renders nothing. */
export default function MobileNav() {
  useEffect(() => {
    const hdr = document.querySelector("header.top");
    const root = document.documentElement;
    let raf = 0;
    const onScroll = () => {
      hdr?.classList.toggle("scrolled", window.scrollY > 8);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; root.style.setProperty("--sy", String(Math.min(window.scrollY, 900))); });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return null;
}
