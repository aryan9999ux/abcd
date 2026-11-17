"use client";
import { useEffect, useRef, useState } from "react";
import "./chat.css";

interface M { role: "user" | "assistant"; text: string }

/** Floating chat bubble. `endpoint` picks the assistant; `greeting` is the first message and the pop-up text. */
export default function Chat({ endpoint, greeting, title, hint, popup = true }: { endpoint: string; greeting: string; title: string; hint: string; popup?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const [msgs, setMsgs] = useState<M[]>([{ role: "assistant", text: greeting }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popup) return;
    try { if (sessionStorage.getItem("chat-popped")) return; } catch {}
    const t = setTimeout(() => { setPop(true); try { sessionStorage.setItem("chat-popped", "1"); } catch {} }, 6000);
    return () => clearTimeout(t);
  }, [popup]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy, open]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    const next = [...msgs, { role: "user" as const, text: t }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const j = await r.json();
      setMsgs([...next, { role: "assistant", text: j.ok ? j.reply : j.error || "Something went wrong." }]);
    } catch { setMsgs([...next, { role: "assistant", text: "No connection. Please try again." }]); }
    setBusy(false);
  }

  return (
    <div className="cb">
      {open && (
        <section className="cb-win" role="dialog" aria-label={title}>
          <header><span className="cb-av">R</span><div><b>{title}</b><small>{hint}</small></div><button aria-label="Close chat" onClick={() => setOpen(false)}>×</button></header>
          <div className="cb-body">
            {msgs.map((m, i) => <p key={i} className={m.role === "user" ? "me" : "bot"}>{m.text}</p>)}
            {busy && <p className="bot typing"><i /><i /><i /></p>}
            <div ref={end} />
          </div>
          <form onSubmit={send}><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your question" maxLength={500} aria-label="Message" /><button disabled={busy || !text.trim()}>Send</button></form>
        </section>
      )}
      {!open && pop && <button className="cb-pop" onClick={() => { setOpen(true); setPop(false); }}>{greeting}<span onClick={(e) => { e.stopPropagation(); setPop(false); }} aria-label="Dismiss">×</span></button>}
      <button className="cb-fab" aria-label={open ? "Close chat" : "Open chat"} onClick={() => { setOpen(!open); setPop(false); }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
      </button>
    </div>
  );
}
