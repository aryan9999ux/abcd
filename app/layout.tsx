import "./globals.css";
import type { ReactNode } from "react";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";


export const metadata = {
  title: "Apex Capital Funded",
  description: "Simulated funded trading accounts for Indian markets.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="orbs" aria-hidden="true">
          <div className="orb a" />
          <div className="orb b" />
          <div className="orb c" />
        </div>
        {children}
      </body>
    </html>
  );
}
