"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Phone-only button that follows the reader, and steps aside near the plans, the final call and the footer. */
export default function StickyCta({ label }: { label: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let past = false; const hidden = new Set<Element>();
    const upd = () => setShow(past && hidden.size === 0);
    const onScroll = () => { past = window.scrollY > 520; upd(); };
    const io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? hidden.add(e.target) : hidden.delete(e.target))); upd(); });
    document.querySelectorAll("#plans, .lx-final").forEach((el) => io.observe(el));
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); io.disconnect(); };
  }, []);
  return <Link href="/signup" className={`stk${show ? " on" : ""}`} aria-hidden={!show} tabIndex={show ? 0 : -1}>{label}</Link>;
}
