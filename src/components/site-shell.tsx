import Link from "next/link";
import type { Route } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { logoutAction } from "@/actions/auth";
import { LoginPageContent } from "@/components/auth/login-page-content";
import { SiteShellPrimaryNav } from "@/components/site-shell-primary-nav";
import {
  APP_SEARCH_HEADER,
  APP_PATHNAME_HEADER,
  AUTH_SESSION_COOKIE,
  hasValidSessionToken,
  isAuthEnabled,
  isLoginPath,
  readRequestPathname,
  readRequestSearch
} from "@/lib/auth";
import { primaryNav, readInternalHref } from "@/lib/site";

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
  const cookieStore = await cookies();
  const pathname = readRequestPathname(headerStore.get(APP_PATHNAME_HEADER));
  const search = readRequestSearch(headerStore.get(APP_SEARCH_HEADER));
  const isStandaloneLogin = isLoginPath(pathname);
  const authEnabled = isAuthEnabled();
  const showLogout = authEnabled;
  const isAuthenticated = authEnabled
    ? hasValidSessionToken(cookieStore.get(AUTH_SESSION_COOKIE)?.value)
    : true;

  if (isStandaloneLogin) {
    if (isAuthenticated) {
      redirect("/");
    }

    return <div className="app-shell">{children}</div>;
  }

  if (!isAuthenticated) {
    const nextHref = readInternalHref(`${pathname}${search}`);

    return (
      <div className="app-shell">
        <LoginPageContent nextHref={nextHref} />
      </div>
    );
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
