import "./globals.css";
import type { ReactNode } from "react";
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/geist-mono/index.css";
import Ambient from "@/components/site/Ambient";

export const metadata = {
  title: "Apex Capital Funded",
  description: "Simulated funded trading accounts for Indian markets.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Ambient />
        {children}
      </body>
    </html>
  );
}
