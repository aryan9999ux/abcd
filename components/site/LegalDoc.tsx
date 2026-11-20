import Link from "next/link";
import Footer from "./Footer";
import { LEGAL_UPDATED, SUPPORT_EMAIL } from "@/lib/brand";

export interface LegalSection { h: string; p: string[] }

const LINKS: [string, string][] = [["/terms", "Terms of Service"], ["/privacy", "Privacy Policy"], ["/risk", "Risk Disclosure"], ["/refund", "Refund Policy"], ["/rules", "Rules"]];

/** One long-form policy page: title, last-updated line, a short summary, a contents list and numbered sections. */
export default function LegalDoc({ title, summary, sections, path }: { title: string; summary: string; sections: LegalSection[]; path: string }) {
  return (
    <>
      <main className="wrap legal">
        <nav className="legal-nav" aria-label="Policies">
          {LINKS.map(([href, label]) => <Link key={href} href={href} aria-current={href === path ? "page" : undefined}>{label}</Link>)}
        </nav>
        <h1>{title}</h1>
        <p className="muted legal-date">Version 1.0 · Last updated {LEGAL_UPDATED}</p>
        <p className="legal-sum">{summary}</p>
        <ol className="legal-toc">
          {sections.map((s, i) => <li key={s.h}><a href={`#s${i + 1}`}>{s.h}</a></li>)}
        </ol>
        {sections.map((s, i) => (
          <section key={s.h} id={`s${i + 1}`} className="legal-sec">
            <h2>{i + 1}. {s.h}</h2>
            {s.p.map((t, j) => <p key={j}>{t}</p>)}
          </section>
        ))}
        <section className="legal-sec">
          <h2>Contact</h2>
          <p>{SUPPORT_EMAIL ? <>Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>, or use Help inside your dashboard.</> : "Use Help inside your dashboard, or the chat on this website."} Support is available Monday to Friday, 10:00 AM to 6:00 PM IST, excluding exchange holidays.</p>
        </section>
      </main>
      <Footer />
    </>
  );
}
