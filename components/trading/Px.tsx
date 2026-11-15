"use client";
import { useEffect, useRef, useState } from "react";

/** Shows a price and flashes green or red for a moment when it ticks up or down. */
export default function Px({ v, text, className = "" }: { v: number | undefined; text: string; className?: string }) {
  const prev = useRef<number | undefined>(v);
  const [dir, setDir] = useState<"" | "fu" | "fd">("");
  useEffect(() => {
    if (v == null || prev.current == null || v === prev.current) { prev.current = v; return; }
    setDir(v > prev.current ? "fu" : "fd");
    prev.current = v;
    const t = setTimeout(() => setDir(""), 650);
    return () => clearTimeout(t);
  }, [v]);
  return <span className={`${className} ${dir}`.trim()}>{text}</span>;
}
