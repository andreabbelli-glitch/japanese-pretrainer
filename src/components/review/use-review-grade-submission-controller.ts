"use client";

import { useCallback, useRef, useState } from "react";

import { gradeReviewCardSessionAction } from "@/actions/review";
import { getSafeReviewForcedContrastClientErrorMessage } from "@/lib/review-error-messages";
import type { ReviewQueueCard } from "@/lib/review-types";

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
  const submittedGradeCardIdsRef = useRef<Set<string>>(new Set());
  const pendingGradeCardIdsRef = useRef<Set<string>>(new Set());
  const blockingGradeSubmissionInFlightRef = useRef(false);
  const gradedCardIdsRef = useRef<Set<string>>(new Set());
  const [submittedGradeCardIds, setSubmittedGradeCardIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [pendingGradeCardIds, setPendingGradeCardIds] = useState<
    ReadonlySet<string>
  >(() => new Set());

  const getGradedCardIds = useCallback(
    () => Array.from(gradedCardIdsRef.current),
    []
  );

  function handleGradeCard(
    rating: ReviewGradeValue,
    context: ReviewGradeSubmissionContext
  ) {
    const { selectedCard } = context;
    if (!selectedCard) {
      return;
    }

    if (
      input.clientError !== null ||
      blockingGradeSubmissionInFlightRef.current ||
      submittedGradeCardIdsRef.current.has(selectedCard.id)
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
      gradedCardIds: Array.from(
        new Set([...gradedCardIdsRef.current, selectedCard.id])
      ),
      isHydratingFullData: context.isHydratingFullData,
      isQueueCard: context.isQueueCard,
      pendingGradeSubmissionCount: pendingGradeCardIdsRef.current.size,
      prefetchedCards: context.prefetchedCards,
      rating,
      selectedCard,
      sessionViewData
    });

    if (gradeSubmissionPlan.kind === "blocked") {
      return;
    }

    gradedCardIdsRef.current.add(selectedCard.id);
    submittedGradeCardIdsRef.current.add(selectedCard.id);
    pendingGradeCardIdsRef.current.add(selectedCard.id);
    setSubmittedGradeCardIds(new Set(submittedGradeCardIdsRef.current));
    setPendingGradeCardIds(new Set(pendingGradeCardIdsRef.current));
    input.setPendingAnsweredCountScroll(sessionViewData.session.answeredCount);
    const { isBlockingGradeSubmission } = gradeSubmissionPlan;
    if (isBlockingGradeSubmission) {
      blockingGradeSubmissionInFlightRef.current = true;
      setHasBlockingGradeSubmissionInFlight(true);
    }

    const releaseGradeSubmission = (options?: { allowRetry?: boolean }) => {
      pendingGradeCardIdsRef.current.delete(selectedCard.id);
      if (options?.allowRetry) {
        submittedGradeCardIdsRef.current.delete(selectedCard.id);
      }
      if (isBlockingGradeSubmission) {
        blockingGradeSubmissionInFlightRef.current = false;
        setHasBlockingGradeSubmissionInFlight(false);
      }
      setPendingGradeCardIds(new Set(pendingGradeCardIdsRef.current));
      setSubmittedGradeCardIds(new Set(submittedGradeCardIdsRef.current));
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
    getGradedCardIds,
    handleGradeCard,
    hasBlockingGradeSubmissionInFlight,
    pendingGradeCardIds,
    submittedGradeCardIds
  };
}
