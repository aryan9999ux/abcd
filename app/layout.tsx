import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Apex Capital Funded",
  description: "Simulated funded trading accounts for Indian markets.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
