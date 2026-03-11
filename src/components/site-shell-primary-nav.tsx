"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  primaryNav,
  readInternalHref,
  resolveActivePrimaryNavHref
} from "@/lib/site";

export function SiteShellPrimaryNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const contextualReviewHref = readInternalHref(
    searchParams.get("returnTo") ?? undefined
  );
  const activePrimaryHref = resolveActivePrimaryNavHref(pathname);

  return (
    <nav aria-label="Navigazione primaria" className="site-nav">
      {primaryNav.map((item) => {
        const active = activePrimaryHref === item.href;
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
  );
}
