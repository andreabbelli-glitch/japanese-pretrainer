import { memo } from "react";
import Link from "next/link";

import { kanjiClashHref } from "@/lib/site";

import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

import type { ReviewPageClientData } from "./review-page-state";

export type ReviewPageSidebarProps = {
  clientError: string | null;
  isGlobalReview: boolean;
  isPending: boolean;
  viewData: ReviewPageClientData;
};

export function ReviewPageSidebar({
  clientError,
  isGlobalReview,
  isPending,
  viewData
}: ReviewPageSidebarProps) {
  return (
    <SurfaceCard className="review-sidebar">
      <p className="eyebrow">Sessione</p>
      <div className="stats-grid review-session-stats">
        <StatBlock
          detail="Card pronte nella sessione di adesso."
          label="In coda"
          value={String(viewData.queue.queueCount)}
        />
        <StatBlock
          detail="Card già in Review previste per oggi."
          label="Da ripassare"
          tone={viewData.queue.dueCount > 0 ? "warning" : "default"}
          value={String(viewData.queue.dueCount)}
        />
        <StatBlock
          detail={
            isGlobalReview
              ? `${viewData.queue.newAvailableCount} nuove disponibili nella review globale.`
              : `${viewData.queue.newAvailableCount} nuove disponibili in totale per questo media.`
          }
          label="Nuove"
          value={String(viewData.queue.newQueuedCount)}
        />
      </div>

      {isGlobalReview ? (
        <div className="review-sidebar__notice">
          <p>Allenati con coppie di kanji simili senza uscire dalla review.</p>
          <Link className="button button--ghost" href={kanjiClashHref()}>
            Apri Kanji Clash
          </Link>
        </div>
      ) : null}

      <div className="stack-list stack-list--tight">
        <div className="summary-row">
          <span>Escluse manualmente</span>
          <strong>{viewData.queue.manualCount}</strong>
        </div>
        <div className="summary-row">
          <span>Sospese</span>
          <strong>{viewData.queue.suspendedCount}</strong>
        </div>
        <div className="summary-row">
          <span>Da ripassare domani</span>
          <strong>{viewData.queue.tomorrowCount}</strong>
        </div>
        <div className="summary-row">
          <span>Da ripassare nei prossimi giorni</span>
          <strong>
            {viewData.queue.upcomingCount - viewData.queue.tomorrowCount}
          </strong>
        </div>
      </div>

      {isPending ? (
        <div className="review-sidebar__notice">
          <p>Aggiornamento della review in corso...</p>
        </div>
      ) : null}

      {clientError ? (
        <div className="review-sidebar__notice">
          <p>{clientError}</p>
        </div>
      ) : null}

      {viewData.session.notice ? (
        <div className="review-sidebar__notice">
          <p>{viewData.session.notice}</p>
        </div>
      ) : null}
    </SurfaceCard>
  );
}

export function areReviewPageSidebarPropsEqual(
  previous: ReviewPageSidebarProps,
  next: ReviewPageSidebarProps
) {
  if (previous === next) {
    return true;
  }

  if (
    previous.clientError !== next.clientError ||
    previous.isGlobalReview !== next.isGlobalReview ||
    previous.isPending !== next.isPending ||
    previous.viewData.session.notice !== next.viewData.session.notice
  ) {
    return false;
  }

  const previousQueue = previous.viewData.queue;
  const nextQueue = next.viewData.queue;

  return (
    previousQueue.queueCount === nextQueue.queueCount &&
    previousQueue.dueCount === nextQueue.dueCount &&
    previousQueue.newAvailableCount === nextQueue.newAvailableCount &&
    previousQueue.newQueuedCount === nextQueue.newQueuedCount &&
    previousQueue.manualCount === nextQueue.manualCount &&
    previousQueue.suspendedCount === nextQueue.suspendedCount &&
    previousQueue.tomorrowCount === nextQueue.tomorrowCount &&
    previousQueue.upcomingCount === nextQueue.upcomingCount
  );
}

export const MemoizedReviewPageSidebar = memo(
  ReviewPageSidebar,
  areReviewPageSidebarPropsEqual
);
