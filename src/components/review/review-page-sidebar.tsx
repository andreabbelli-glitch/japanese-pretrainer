import { memo } from "react";
import Link from "next/link";

import { buildHrefWithSearch, kanjiClashHref } from "@/features/navigation";

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
  const isPrestudy = viewData.mode === "prestudy";
  const prestudyHref = buildHrefWithSearch(
    viewData.media.reviewHref,
    (params) => {
      params.set("mode", "prestudy");
    }
  );
  const prestudyTotalCards =
    viewData.session.prestudy?.totalCards ?? viewData.queue.queueCount;
  const prestudyViewedCards = Math.min(
    viewData.session.answeredCount,
    prestudyTotalCards
  );
  const prestudyRemainingCards = Math.max(
    prestudyTotalCards - prestudyViewedCards,
    0
  );

  return (
    <SurfaceCard className="review-sidebar">
      <p className="eyebrow">Sessione</p>

      {!isGlobalReview ? (
        <nav className="review-mode-toggle" aria-label="Modalità review">
          <Link
            aria-current={!isPrestudy ? "page" : undefined}
            className="review-mode-toggle__link"
            href={viewData.media.reviewHref}
          >
            Review
          </Link>
          <Link
            aria-current={isPrestudy ? "page" : undefined}
            className="review-mode-toggle__link"
            href={prestudyHref}
          >
            Prestudy
          </Link>
        </nav>
      ) : null}

      <div className="stats-grid review-session-stats">
        {isPrestudy ? (
          <>
            <StatBlock
              detail={
                viewData.session.prestudy
                  ? viewData.session.prestudy.lessonTitle
                  : "Nessuna lesson con card attive da preparare."
              }
              label="Card lesson"
              value={String(prestudyTotalCards)}
            />
            <StatBlock
              detail="Card già aperte in questa sessione prestudy."
              label="Viste"
              value={String(prestudyViewedCards)}
            />
            <StatBlock
              detail="Card ancora da guardare prima della lezione."
              label="Rimanenti"
              value={String(prestudyRemainingCards)}
            />
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {isGlobalReview && !isPrestudy ? (
        <div className="review-sidebar__notice">
          <p>Allenati con coppie di kanji simili senza uscire dalla review.</p>
          <Link className="button button--ghost" href={kanjiClashHref()}>
            Apri Kanji Clash
          </Link>
        </div>
      ) : null}

      {isPrestudy ? null : (
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
      )}

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
    previous.viewData.mode !== next.viewData.mode ||
    previous.viewData.session.answeredCount !==
      next.viewData.session.answeredCount ||
    previous.viewData.session.prestudy?.lessonId !==
      next.viewData.session.prestudy?.lessonId ||
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
    previousQueue.nextDueAt === nextQueue.nextDueAt &&
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
