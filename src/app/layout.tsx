import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteShell } from "@/components/site-shell";

import "./globals.css";

export const metadata: Metadata = {
  title: "Japanese Custom Study",
  description:
    "Webapp locale-first per preparare lo studio del giapponese a partire da media specifici."
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="it">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
