import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

import type { ReviewPageClientData } from "./review-page-state";

export function ReviewPageSidebar({
  clientError,
  isGlobalReview,
  isPending,
  viewData
}: {
  clientError: string | null;
  isGlobalReview: boolean;
  isPending: boolean;
  viewData: ReviewPageClientData;
}) {
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
          <span>Da ripassare nei prossimi giorni</span>
          <strong>{viewData.queue.upcomingCount}</strong>
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
