"use client";
import { useCallback, useRef, useState, type ReactNode } from "react";

/** Short status message pinned to the bottom of the screen. */
export function useToast(): { node: ReactNode; show: (text: string, error?: boolean) => void } {
  const [t, setT] = useState<{ text: string; err: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string, error = false) => {
    setT({ text, err: error });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), error ? 4500 : 2600);
  }, []);
  const node = t ? (
    <div className={"tr-toast tr-glass" + (t.err ? " err" : "")} role="status">
      {t.text}
    </div>
  ) : null;
  return { node, show };
}
