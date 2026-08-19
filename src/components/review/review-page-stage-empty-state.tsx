import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

import { buildCanonicalReviewSessionHrefForBase } from "@/features/navigation";

import { EmptyState } from "../ui/empty-state";
import {
  formatTopUpLabel,
  resolveReviewQueueRefreshState
} from "./review-page-helpers";
import type { ReviewPageClientData } from "./review-page-state";

export function ReviewPageStageEmptyState({
  additionalNewCount,
  contextualGlossaryHref,
  handleRefreshQueue,
  hasSupportCards,
  isGlobalReview,
  isPending,
  showCompletionState,
  viewData
}: {
  additionalNewCount: number;
  contextualGlossaryHref: Route;
  handleRefreshQueue: () => void;
  hasSupportCards: boolean;
  isGlobalReview: boolean;
  isPending: boolean;
  showCompletionState: boolean;
  viewData: ReviewPageClientData;
}) {
  const isPrestudy = viewData.mode === "prestudy";

  if (!showCompletionState) {
    return (
      <EmptyState
        title={
          isGlobalReview
            ? "Nessuna card pronta nella review globale."
            : "Nessuna card da gestire."
        }
        description={
          isGlobalReview
            ? "Quando importerai le prime card o riattiverai una voce dal Glossary, qui riapparirà il flusso della review globale."
            : "Quando importerai le prime card o riattiverai una voce dal Glossary, qui riapparirà il flusso di Review del media."
        }
        action={
          <Link className="button button--ghost" href={contextualGlossaryHref}>
            Apri Glossary
          </Link>
        }
      />
    );
  }

  return (
    <EmptyState
      title={resolveCompletionTitle({
        answeredCount: viewData.session.answeredCount,
        isGlobalReview,
        isPrestudy
      })}
      description={resolveCompletionDescription({
        additionalNewCount,
        hasSupportCards,
        isGlobalReview,
        isPrestudy
      })}
      action={
        <>
          {additionalNewCount > 0 ? (
            <Link
              className="button button--primary"
              href={buildCanonicalReviewSessionHrefForBase({
                answeredCount: viewData.session.answeredCount,
                baseHref: viewData.media.reviewHref,
                extraNewAnchorCount: viewData.session.extraNewAnchorCount,
                extraNewCount:
                  viewData.session.extraNewCount + additionalNewCount,
                isQueueCard: true,
                mode: viewData.mode,
                position: 1,
                segmentId: viewData.session.segmentId
              })}
            >
              {formatTopUpLabel(additionalNewCount)}
            </Link>
          ) : null}
          {!isPrestudy ? (
            <ReviewQueueRefreshButton
              key={viewData.queue.nextDueAt ?? "no-next-due"}
              isPending={isPending}
              nextDueAt={viewData.queue.nextDueAt ?? null}
              onRefresh={handleRefreshQueue}
            />
          ) : null}
          <Link className="button button--ghost" href={contextualGlossaryHref}>
            Apri Glossary
          </Link>
        </>
      }
    />
  );
}

function resolveCompletionTitle({
  answeredCount,
  isGlobalReview,
  isPrestudy
}: {
  answeredCount: number;
  isGlobalReview: boolean;
  isPrestudy: boolean;
}) {
  if (isPrestudy) {
    return "Non ci sono card di prestudy per la prossima lezione.";
  }

  if (isGlobalReview) {
    return answeredCount > 0
      ? "Sessione chiusa, ora sei in pari su tutta la Review."
      : "Oggi sei in pari su tutta la Review.";
  }

  return answeredCount > 0
    ? "Sessione chiusa, ora sei in pari."
    : "Oggi sei in pari.";
}

function resolveCompletionDescription({
  additionalNewCount,
  hasSupportCards,
  isGlobalReview,
  isPrestudy
}: {
  additionalNewCount: number;
  hasSupportCards: boolean;
  isGlobalReview: boolean;
  isPrestudy: boolean;
}) {
  if (isPrestudy) {
    return "Quando la prossima lezione con card attive sarà disponibile, questa modalità mostrerà automaticamente quelle card.";
  }

  if (additionalNewCount > 0) {
    const cardSuffix = additionalNewCount === 1 ? "" : " card";

    return isGlobalReview
      ? `La coda di oggi è finita. Puoi chiudere qui oppure aggiungere subito altre ${additionalNewCount} nuove${cardSuffix} alla rotazione attuale della review globale.`
      : `La coda di oggi è finita. Puoi chiudere qui oppure aggiungere subito altre ${additionalNewCount} nuove${cardSuffix} alla rotazione attuale di questo media.`;
  }

  if (hasSupportCards) {
    return "La coda di oggi non richiede altre risposte. Se ti serve intervenire su card già note, sospese o fuori finestra, puoi farlo dal Glossary o dalle impostazioni di studio.";
  }

  return isGlobalReview
    ? "La review globale non ha ancora card da lavorare o mantenere adesso."
    : "Per questo media non ci sono altre card da lavorare o mantenere adesso.";
}

function ReviewQueueRefreshButton({
  isPending,
  nextDueAt,
  onRefresh
}: {
  isPending: boolean;
  nextDueAt: string | null;
  onRefresh: () => void;
}) {
  const now = useReviewQueueRefreshClock(nextDueAt);
  const queueRefreshState = resolveReviewQueueRefreshState({
    isPending,
    nextDueAt,
    now
  });

  return (
    <>
      <button
        className="button button--primary"
        disabled={!queueRefreshState.canRefresh}
        type="button"
        onClick={onRefresh}
      >
        {queueRefreshState.buttonLabel}
      </button>
      <p className="review-stage__hint">{queueRefreshState.statusLabel}</p>
    </>
  );
}

function useReviewQueueRefreshClock(nextDueAt: string | null) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!nextDueAt) {
      return;
    }

    const dueTime = new Date(nextDueAt).getTime();
    const msUntilDue = dueTime - now.getTime();

    if (!Number.isFinite(msUntilDue) || msUntilDue <= 0) {
      return;
    }

    const timeout = window.setTimeout(
      () => setNow(new Date()),
      Math.max(1_000, Math.min(msUntilDue, 60_000))
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [nextDueAt, now]);

  return now;
}
