"use client";
import { useRef, useState } from "react";
import { num } from "./format";

/** A stop loss or target value in a table: click to type a new price, empty to remove. */
export function LevelCell({ value, kind, disabled, onSave }: {
  value: number | null | undefined;
  kind: "stop" | "target";
  disabled?: boolean;
  onSave: (price: number | null) => Promise<boolean>;
}) {
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const tone = kind === "stop" ? "tr-down" : "tr-up";

  async function commit() {
    const raw = ref.current?.value.trim() ?? "";
    const next = raw === "" ? null : Number(raw);
    if (next != null && !(next > 0)) { setEdit(false); return; }
    if (next === (value ?? null)) { setEdit(false); return; }
    setBusy(true);
    await onSave(next);
    setBusy(false); setEdit(false);
  }

  if (edit) {
    return (
      <input ref={ref} className="tr-lvlin tr-mono" type="number" step={0.05} autoFocus defaultValue={value ?? ""} disabled={busy}
        aria-label={kind === "stop" ? "Stop loss price" : "Target price"} placeholder="Price"
        onKeyDown={(e) => { if (e.key === "Enter") void commit(); else if (e.key === "Escape") setEdit(false); }}
        onBlur={() => void commit()} />
    );
  }
  return (
    <button className={"tr-lvl " + (value != null ? tone : "")} disabled={disabled} onClick={() => setEdit(true)}
      title={kind === "stop" ? "Edit stop loss" : "Edit target"}>
      {value != null ? <span className="tr-mono">{num(value)}</span> : <span className="add">+ Add</span>}
    </button>
  );
}
