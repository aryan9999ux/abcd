import "./globals.css";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Header from "@/components/site/Header";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"], display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"], display: "swap" });

export const metadata = {
  title: "Apex Capital Funded",
  description: "Simulated funded trading accounts for Indian markets.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <div className="orbs" aria-hidden="true">
          <div className="orb a" />
          <div className="orb b" />
          <div className="orb c" />
        </div>
        <Header />
        {children}
      </body>
    </html>
  );
}
