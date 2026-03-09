import type { ElementType, ReactNode } from "react";

import { cx } from "@/lib/classnames";

type SurfaceCardProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
  variant?: "default" | "hero" | "quiet" | "accent";
};

export function SurfaceCard<T extends ElementType = "article">({
  as,
  children,
  className,
  variant = "default"
}: SurfaceCardProps<T>) {
  const Component = as ?? "article";

  return (
    <Component className={cx("surface-card", `surface-card--${variant}`, className)}>
      {children}
    </Component>
  );
}
