import "./globals.css";
import type { ReactNode } from "react";
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/plus-jakarta-sans/index.css";
import "@fontsource-variable/geist-mono/index.css";
import Ambient from "@/components/site/Ambient";

export const metadata = {
  title: "Edge Funded",
  description: "Funded trading accounts for Indian markets. Trade our capital, keep the profit.",
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
