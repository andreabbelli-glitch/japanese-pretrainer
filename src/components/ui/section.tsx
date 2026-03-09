import type { ReactNode } from "react";

import { cx } from "@/lib/classnames";

type SectionProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Section({
  eyebrow,
  title,
  description,
  actions,
  className,
  children
}: SectionProps) {
  return (
    <section className={cx("app-section", className)}>
      {eyebrow || title || description || actions ? (
        <header className="app-section__header">
          <div className="app-section__copy">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="app-section__title">{title}</h2> : null}
            {description ? (
              <p className="app-section__description">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="app-section__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
