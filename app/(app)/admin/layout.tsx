import Link from "next/link";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="wrap" style={{ display: "flex", gap: 18, paddingTop: 20, flexWrap: "wrap" }}>
        <Link href="/admin/zerodha">Zerodha</Link>
        <Link href="/admin/rewards">Rewards</Link>
        <Link href="/admin/simulator">Simulator &amp; rules</Link>
        <Link href="/">Site</Link>
      </nav>
      {children}
    </>
  );
}
