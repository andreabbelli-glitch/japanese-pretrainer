import type { ReactNode } from "react";

import { SurfaceCard } from "./surface-card";

type EmptyStateProps = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({
  eyebrow,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <SurfaceCard className="empty-state" variant="quiet">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="empty-state__title">{title}</h2>
      <p className="empty-state__description">{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </SurfaceCard>
  );
}
