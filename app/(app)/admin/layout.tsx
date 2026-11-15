import Header from "@/components/site/Header";
import AdminNav from "@/components/admin/AdminNav";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <AdminNav />
      {children}
    </>
  );
}
