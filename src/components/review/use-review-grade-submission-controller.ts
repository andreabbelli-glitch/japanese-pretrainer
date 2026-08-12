"use client";

import { useRef, useState } from "react";

import { gradeReviewCardSessionAction } from "@/actions/review";
import {
  getSafeReviewForcedContrastClientErrorMessage,
  type ReviewQueueCard
} from "@/features/review/client";

import { isReviewPageData, type ReviewGradeValue } from "./review-page-helpers";
import { buildReviewGradeSubmissionPlan } from "./review-page-grade-flow";
import type {
  ReviewForcedContrastSelection,
  ReviewPageClientData
} from "./review-page-state";
import type { useReviewSessionUpdateRunner } from "./use-review-session-update-runner";

type ReviewSessionUpdateRunner = ReturnType<
  typeof useReviewSessionUpdateRunner
>;

export type ReviewGradeSubmissionContext = {
  activeQueueCardIds: string[];
  advanceWindowCardIds: string[];
  isHydratingFullData: boolean;
  isQueueCard: boolean;
  prefetchedCards: ReadonlyMap<string, ReviewQueueCard>;
  queueCardIds: string[];
  selectedCard: ReviewPageClientData["selectedCard"];
  viewData: ReviewPageClientData;
};

export function useReviewGradeSubmissionController(input: {
  clientError: string | null;
  enqueueOptimisticGradeSessionUpdate: ReviewSessionUpdateRunner["enqueueOptimisticGradeSessionUpdate"];
  forcedContrastSelection: ReviewForcedContrastSelection | null;
  latestViewDataRef: { current: ReviewPageClientData };
  runSessionUpdate: ReviewSessionUpdateRunner["runSessionUpdate"];
  setPendingAnsweredCountScroll: (answeredCount: number | null) => void;
  setQueueCardIds: (queueCardIds: string[]) => void;
  setViewData: (nextData: ReviewPageClientData) => void;
}) {
  const [
    hasBlockingGradeSubmissionInFlight,
    setHasBlockingGradeSubmissionInFlight
  ] = useState(false);
  const submittedGradeAttemptByCardRef = useRef<Map<string, string>>(new Map());
  const pendingGradeAttemptKeysRef = useRef<Set<string>>(new Set());
  const blockingGradeSubmissionInFlightRef = useRef(false);
  const [submittedGradeCardIds, setSubmittedGradeCardIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [pendingGradeCardIds, setPendingGradeCardIds] = useState<
    ReadonlySet<string>
  >(() => new Set());

  function handleGradeCard(
    rating: ReviewGradeValue,
    context: ReviewGradeSubmissionContext
  ) {
    const { selectedCard } = context;
    if (!selectedCard) {
      return;
    }

    const gradeAttemptKey = buildReviewGradeAttemptKey({
      answeredCount: context.viewData.session.answeredCount,
      cardId: selectedCard.id,
      expectedUpdatedAt:
        context.viewData.selectedCardContext.reviewStateUpdatedAt ?? null
    });

    if (
      input.clientError !== null ||
      blockingGradeSubmissionInFlightRef.current ||
      submittedGradeAttemptByCardRef.current.get(selectedCard.id) ===
        gradeAttemptKey
    ) {
      return;
    }

    const sessionViewData = context.viewData;
    const fullViewData = isReviewPageData(sessionViewData)
      ? sessionViewData
      : null;
    const gradeSubmissionPlan = buildReviewGradeSubmissionPlan({
      activeQueueCardIds: context.activeQueueCardIds,
      advanceWindowCardIds: context.advanceWindowCardIds,
      forcedContrastSelection: input.forcedContrastSelection,
      fullViewData,
      isHydratingFullData: context.isHydratingFullData,
      isQueueCard: context.isQueueCard,
      pendingGradeSubmissionCount: pendingGradeAttemptKeysRef.current.size,
      prefetchedCards: context.prefetchedCards,
      rating,
      selectedCard,
      sessionViewData
    });

    if (gradeSubmissionPlan.kind === "blocked") {
      return;
    }

    submittedGradeAttemptByCardRef.current.set(
      selectedCard.id,
      gradeAttemptKey
    );
    pendingGradeAttemptKeysRef.current.add(gradeAttemptKey);
    setSubmittedGradeCardIds(
      (current) => new Set([...current, selectedCard.id])
    );
    setPendingGradeCardIds((current) => new Set([...current, selectedCard.id]));
    input.setPendingAnsweredCountScroll(sessionViewData.session.answeredCount);
    const { isBlockingGradeSubmission } = gradeSubmissionPlan;
    if (isBlockingGradeSubmission) {
      blockingGradeSubmissionInFlightRef.current = true;
      setHasBlockingGradeSubmissionInFlight(true);
    }

    const releaseGradeSubmission = (options?: { allowRetry?: boolean }) => {
      pendingGradeAttemptKeysRef.current.delete(gradeAttemptKey);
      if (
        options?.allowRetry &&
        submittedGradeAttemptByCardRef.current.get(selectedCard.id) ===
          gradeAttemptKey
      ) {
        submittedGradeAttemptByCardRef.current.delete(selectedCard.id);
      }
      if (isBlockingGradeSubmission) {
        blockingGradeSubmissionInFlightRef.current = false;
        setHasBlockingGradeSubmissionInFlight(false);
      }
      setPendingGradeCardIds((current) => {
        const next = new Set(current);
        next.delete(selectedCard.id);
        return next;
      });
      setSubmittedGradeCardIds((current) => {
        const next = new Set(current);
        next.delete(selectedCard.id);
        return next;
      });
    };

    const forcedContrastUpdateOptions =
      gradeSubmissionPlan.forcedKanjiClashContrast
        ? {
            errorResolver: (error: unknown) =>
              getSafeReviewForcedContrastClientErrorMessage(error) ??
              "Non sono riuscito ad aggiornare la review. Riprova un attimo.",
            shouldLogError: (error: unknown) =>
              getSafeReviewForcedContrastClientErrorMessage(error) === null
          }
        : {};

    if (gradeSubmissionPlan.kind === "preserve-card") {
      input.runSessionUpdate(
        () => gradeReviewCardSessionAction(gradeSubmissionPlan.actionInput),
        {
          ...forcedContrastUpdateOptions,
          onError: () => {
            releaseGradeSubmission({ allowRetry: true });
            input.setPendingAnsweredCountScroll(null);
          },
          onDiscarded: () => {
            releaseGradeSubmission();
          },
          onSuccess: () => {
            releaseGradeSubmission();
          }
        }
      );
      return;
    }

    const runGradeSessionUpdate = gradeSubmissionPlan.canOptimisticallyAdvance
      ? input.enqueueOptimisticGradeSessionUpdate
      : input.runSessionUpdate;

    runGradeSessionUpdate(
      () => gradeReviewCardSessionAction(gradeSubmissionPlan.actionInput),
      {
        ...forcedContrastUpdateOptions,
        acceptSameProgressSelectionChange: true,
        onError: () => {
          releaseGradeSubmission({ allowRetry: true });
          input.setPendingAnsweredCountScroll(null);
        },
        onDiscarded: () => {
          releaseGradeSubmission();
        },
        optimisticUpdate: gradeSubmissionPlan.canOptimisticallyAdvance
          ? () => {
              const previousViewData = gradeSubmissionPlan.optimisticSourceData;
              const previousQueueCardIds = context.queueCardIds;
              const optimisticViewData = gradeSubmissionPlan.optimisticViewData;

              if (!previousViewData || !optimisticViewData) {
                return undefined;
              }

              input.latestViewDataRef.current = optimisticViewData;
              input.setViewData(optimisticViewData);
              input.setQueueCardIds(gradeSubmissionPlan.nextQueueCardIds);

              return (options) => {
                const currentViewData = input.latestViewDataRef.current;
                const forceRollback = options?.force ?? false;
                if (
                  !forceRollback &&
                  (currentViewData.session.answeredCount !==
                    optimisticViewData.session.answeredCount ||
                    currentViewData.selectedCard?.id !==
                      optimisticViewData.selectedCard?.id)
                ) {
                  return;
                }

                input.latestViewDataRef.current = previousViewData;
                input.setViewData(previousViewData);
                input.setQueueCardIds(previousQueueCardIds);
              };
            }
          : undefined,
        onSuccess: (nextData) => {
          releaseGradeSubmission();
          if (nextData.queueCardIds.length === 0) {
            input.setQueueCardIds(gradeSubmissionPlan.nextQueueCardIds);
          }
        },
        shouldSyncQueueCardIds: (nextData) => nextData.queueCardIds.length > 0
      }
    );
  }

  return {
    handleGradeCard,
    hasBlockingGradeSubmissionInFlight,
    pendingGradeCardIds,
    submittedGradeCardIds
  };
}

export function buildReviewGradeAttemptKey(input: {
  answeredCount: number;
  cardId: string;
  expectedUpdatedAt: string | null;
}) {
  return JSON.stringify([
    input.cardId,
    input.expectedUpdatedAt,
    input.answeredCount
  ]);
}
