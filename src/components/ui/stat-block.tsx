import type { ReactNode } from "react";

import { cx } from "@/lib/classnames";

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
    <article className={cx("stat-block", `stat-block--${tone}`, className)}>
      <div className="stat-block__label-row">
        <span className="stat-block__label">{label}</span>
        {icon ? <span className="stat-block__icon">{icon}</span> : null}
      </div>
      <strong className="stat-block__value">{value}</strong>
      {detail ? <p className="stat-block__detail">{detail}</p> : null}
    </article>
  );
}
