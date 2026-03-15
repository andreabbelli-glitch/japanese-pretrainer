import Link from "next/link";
import type { Route } from "next";
import { headers } from "next/headers";
import { Suspense, type ReactNode } from "react";

import { logoutAction } from "@/actions/auth";
import { SiteShellPrimaryNav } from "@/components/site-shell-primary-nav";
import {
  APP_PATHNAME_HEADER,
  isAuthEnabled,
  isLoginPath,
  readRequestPathname
} from "@/lib/auth";
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

export async function SiteShell({ children }: SiteShellProps) {
  const headerStore = await headers();
  const pathname = readRequestPathname(headerStore.get(APP_PATHNAME_HEADER));
  const isStandaloneLogin = isLoginPath(pathname);
  const showLogout = isAuthEnabled();

  if (isStandaloneLogin) {
    return <div className="app-shell">{children}</div>;
  }

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

          {showLogout ? (
            <form action={logoutAction}>
              <button className="button button--ghost button--small" type="submit">
                Esci
              </button>
            </form>
          ) : null}
        </div>
      </header>

      <main className="page-shell">{children}</main>
    </div>
  );
}
