import type { ReactNode } from "react";

import { cx } from "@/features/shared/ui/classnames";

type StatBlockProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "accent" | "warning";
  className?: string;
  icon?: ReactNode;
};

export function StatBlock({
  label,
  value,
  detail,
  tone = "default",
  className,
  icon
}: StatBlockProps) {
  return (
    <article
      className={cx("stat-block", `stat-block--${tone}`, className)}
      data-testid="stat-block"
    >
      <div className="stat-block__label-row">
        <span className="stat-block__label" data-testid="stat-block-label">
          {label}
        </span>
        {icon ? <span className="stat-block__icon">{icon}</span> : null}
      </div>
      <strong className="stat-block__value" data-testid="stat-block-value">
        {value}
      </strong>
      {detail ? <p className="stat-block__detail">{detail}</p> : null}
    </article>
  );
}
