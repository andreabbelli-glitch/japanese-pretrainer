import type { Metadata } from "next";
import "./globals.css";
import { MainNav } from "@/src/components/main-nav";

export const metadata: Metadata = {
  title: "Duel Masters JP Trainer",
  description: "Webapp verticale per studiare il giapponese delle carte Duel Masters",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>
        <MainNav />
        <main className="mx-auto max-w-5xl p-4">{children}</main>
      </body>
    </html>
  );
}
