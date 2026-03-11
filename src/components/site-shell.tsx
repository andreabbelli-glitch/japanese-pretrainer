"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { primaryNav, readInternalHref } from "@/lib/site";

type SiteShellProps = {
  children: ReactNode;
};

const isCurrentRoute = (pathname: string, href: string) => {
  if (href === "/") {
    return pathname === href;
  }

  return pathname.startsWith(href);
};

export function SiteShell({ children }: SiteShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const contextualReviewHref = readInternalHref(
    searchParams.get("returnTo") ?? undefined
  );

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" href="/">
            <span className="brand__eyebrow">Japanese Custom Study</span>
            <span className="brand__title">Scrivania editoriale</span>
          </Link>

          <nav aria-label="Navigazione primaria" className="site-nav">
            {primaryNav.map((item) => {
              const active = isCurrentRoute(pathname, item.href);
              const href =
                item.href === "/review" && contextualReviewHref
                  ? contextualReviewHref
                  : item.href;

              return (
                <Link
                  key={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`site-nav__link${active ? " site-nav__link--active" : ""}`}
                  href={href}
                >
                  <span>{item.label}</span>
                  <small>{item.description}</small>
                </Link>
              );
            })}
          </nav>

          <div className="site-header__meta">
            <span className="site-header__meta-label">Locale-first</span>
            <span className="site-header__meta-divider" aria-hidden="true">
              ·
            </span>
            <span className="site-header__meta-value">single-user</span>
          </div>
        </div>
      </header>

      <main className="page-shell">{children}</main>

      <nav aria-label="Navigazione mobile" className="mobile-nav">
        {primaryNav.map((item) => {
          const active = isCurrentRoute(pathname, item.href);
          const href =
            item.href === "/review" && contextualReviewHref
              ? contextualReviewHref
              : item.href;

          return (
            <Link
              key={item.href}
              aria-current={active ? "page" : undefined}
              className={`mobile-nav__link${active ? " mobile-nav__link--active" : ""}`}
              href={href}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
