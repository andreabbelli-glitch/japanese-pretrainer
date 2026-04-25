"use client";

import { useCallback, useRef, useTransition } from "react";

import type { ReviewPageData } from "@/lib/review-types";

import {
  getInitiallyRevealedCardId,
  mergeReviewPageData,
  shouldAcceptServerReviewData,
  type ReviewPageClientData
} from "./review-page-state";

type LoadReviewSessionData = () => Promise<ReviewPageData>;

export type ReviewSessionUpdateOptions = {
  errorResolver?: (error: unknown) => string;
  onDiscarded?: (nextData: ReviewPageData) => void;
  onError?: () => void;
  onSuccess?: (nextData: ReviewPageData) => void;
  optimisticUpdate?: () => ReviewOptimisticRollback | void;
  shouldLogError?: (error: unknown) => boolean;
  shouldSyncQueueCardIds?: (nextData: ReviewPageData) => boolean;
};

export type ReviewOptimisticRollback = (options?: { force?: boolean }) => void;

export function useReviewSessionUpdateRunner(input: {
  getLatestViewData: () => ReviewPageClientData;
  isGlobalReview: boolean;
  requestedSelectedCardId: string | null;
  setClientError: (clientError: string | null) => void;
  setLatestViewData: (nextData: ReviewPageClientData) => void;
  setQueueCardIds: (queueCardIds: string[]) => void;
  setRevealedCardId: (cardId: string | null) => void;
  setViewData: (nextData: ReviewPageClientData) => void;
}) {
  const gradeQueueTailRef = useRef<Promise<void>>(Promise.resolve());
  const gradeQueueActiveRef = useRef(false);
  const gradeQueueFailedRef = useRef(false);
  const [isPending, startTransition] = useTransition();

  const resetQueuedGradeFailure = useCallback(() => {
    gradeQueueFailedRef.current = false;
  }, []);

  function runSessionUpdate(
    loadNextData: LoadReviewSessionData,
    options?: ReviewSessionUpdateOptions
  ) {
    input.setClientError(null);
    const rollbackOptimisticUpdate = options?.optimisticUpdate?.();

    startTransition(() => {
      void executeSessionUpdate(
        loadNextData,
        options,
        rollbackOptimisticUpdate
      );
    });
  }

  function enqueueOptimisticGradeSessionUpdate(
    loadNextData: LoadReviewSessionData,
    options?: ReviewSessionUpdateOptions
  ) {
    input.setClientError(null);
    const rollbackOptimisticUpdate = options?.optimisticUpdate?.();
    const runQueuedUpdate = () => {
      if (gradeQueueFailedRef.current) {
        options?.onError?.();
        return Promise.resolve();
      }

      return executeSessionUpdate(
        loadNextData,
        {
          ...options,
          onError: () => {
            gradeQueueFailedRef.current = true;
            options?.onError?.();
          }
        },
        rollbackOptimisticUpdate
          ? () => rollbackOptimisticUpdate({ force: true })
          : undefined
      );
    };

    const nextTail = gradeQueueActiveRef.current
      ? gradeQueueTailRef.current.then(runQueuedUpdate, runQueuedUpdate)
      : runQueuedUpdate();
    gradeQueueActiveRef.current = true;

    const trackedTail = nextTail.finally(() => {
      if (gradeQueueTailRef.current === trackedTail) {
        gradeQueueActiveRef.current = false;
      }
    });
    gradeQueueTailRef.current = trackedTail;
  }

  function executeSessionUpdate(
    loadNextData: LoadReviewSessionData,
    options: ReviewSessionUpdateOptions | undefined,
    rollbackOptimisticUpdate: ReviewOptimisticRollback | void
  ) {
    return loadNextData()
      .then((nextData) => {
        const currentViewData = input.getLatestViewData();
        if (
          !shouldAcceptServerReviewData(
            currentViewData,
            nextData,
            input.requestedSelectedCardId,
            input.isGlobalReview
          )
        ) {
          options?.onDiscarded?.(nextData);
          return;
        }

        const mergedData = mergeReviewPageData(currentViewData, nextData);

        input.setLatestViewData(mergedData);
        input.setViewData(mergedData);
        input.setRevealedCardId(getInitiallyRevealedCardId(mergedData));
        if (options?.shouldSyncQueueCardIds?.(nextData) ?? true) {
          input.setQueueCardIds(nextData.queueCardIds);
        }
        options?.onSuccess?.(mergedData);
      })
      .catch((error) => {
        if (options?.shouldLogError?.(error) ?? true) {
          console.error(error);
        }
        rollbackOptimisticUpdate?.();
        options?.onError?.();
        input.setClientError(
          options?.errorResolver?.(error) ??
            "Non sono riuscito ad aggiornare la review. Riprova un attimo."
        );
      });
  }

  return {
    enqueueOptimisticGradeSessionUpdate,
    isPending,
    resetQueuedGradeFailure,
    runSessionUpdate
  };
}
