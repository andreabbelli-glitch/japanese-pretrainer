import type { ElementType, ReactNode } from "react";

import { cx } from "@/features/shared/ui/classnames";

type SurfaceCardProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
  testId?: string;
  variant?: "default" | "hero" | "quiet" | "accent";
};

export function SurfaceCard<T extends ElementType = "article">({
  as,
  children,
  className,
  testId,
  variant = "default"
}: SurfaceCardProps<T>) {
  const Component = as ?? "article";

  return (
    <Component
      className={cx("surface-card", `surface-card--${variant}`, className)}
      data-testid={testId}
    >
      {children}
    </Component>
  );
}
