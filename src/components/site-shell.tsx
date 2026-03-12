import Link from "next/link";
import type { Route } from "next";
import { Suspense, type ReactNode } from "react";

import { SiteShellPrimaryNav } from "@/components/site-shell-primary-nav";
import { primaryNav } from "@/lib/site";

type SiteShellProps = {
  children: ReactNode;
};

function SiteShellPrimaryNavFallback() {
  return (
    <nav aria-label="Navigazione primaria" className="site-nav">
      {primaryNav.map((item) => (
        <Link
          key={item.href}
          className="site-nav__link"
          href={item.href as Route}
        >
          <span>{item.label}</span>
          <small>{item.description}</small>
        </Link>
      ))}
    </nav>
  );
}

export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" href="/">
            <span className="brand__eyebrow">Japanese Custom Study</span>
            <span className="brand__title">Studio del giapponese</span>
          </Link>

          <Suspense fallback={<SiteShellPrimaryNavFallback />}>
            <SiteShellPrimaryNav />
          </Suspense>
        </div>
      </header>

      <main className="page-shell">{children}</main>
    </div>
  );
}
