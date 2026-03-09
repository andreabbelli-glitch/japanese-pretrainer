import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { cx } from "@/lib/classnames";

type StickyPageHeaderProps = {
  eyebrow?: string;
  title: string;
  summary?: string;
  backHref?: Route;
  backLabel?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function StickyPageHeader({
  eyebrow,
  title,
  summary,
  backHref,
  backLabel,
  meta,
  actions,
  className
}: StickyPageHeaderProps) {
  return (
    <header className={cx("sticky-page-header", className)}>
      <div className="sticky-page-header__inner">
        <div className="sticky-page-header__copy">
          {backHref && backLabel ? (
            <Link className="sticky-page-header__back" href={backHref}>
              {backLabel}
            </Link>
          ) : null}
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="sticky-page-header__title">{title}</h1>
          {summary ? (
            <p className="sticky-page-header__summary">{summary}</p>
          ) : null}
          {meta ? <div className="sticky-page-header__meta">{meta}</div> : null}
        </div>
        {actions ? <div className="sticky-page-header__actions">{actions}</div> : null}
      </div>
    </header>
  );
}
