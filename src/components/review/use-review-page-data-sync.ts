"use client";

import {
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction
} from "react";

import { loadReviewPageDataSessionAction } from "@/actions/review";

import {
  getInitiallyRevealedCardId,
  mergeReviewPageData,
  shouldAcceptServerReviewData,
  shouldAdoptServerFirstCandidateData,
  type ReviewPageClientData
} from "./review-page-state";
import { isReviewPageData } from "./review-page-helpers";
import {
  buildSuccessfulHydrationResult,
  resolveHydratedFirstCandidateRevealedCardId
} from "./review-page-client-utils";

type ReviewSearchParams = Record<string, string | string[] | undefined>;

export function useReviewPageDataSync(input: {
  currentSearchParams?: ReviewSearchParams;
  data: ReviewPageClientData;
  globalHydrationRequestKey: string | null;
  isGlobalReview: boolean;
  latestViewDataRef: RefObject<ReviewPageClientData>;
  requestedSelectedCardId: string | null;
  resetQueuedGradeFailure: () => void;
  setClientError: Dispatch<SetStateAction<string | null>>;
  setQueueCardIds: Dispatch<SetStateAction<string[]>>;
  setRevealedCardId: Dispatch<SetStateAction<string | null>>;
  setViewData: Dispatch<SetStateAction<ReviewPageClientData>>;
  viewData: ReviewPageClientData;
}) {
  const {
    currentSearchParams,
    data,
    globalHydrationRequestKey,
    isGlobalReview,
    latestViewDataRef,
    requestedSelectedCardId,
    resetQueuedGradeFailure,
    setClientError,
    setQueueCardIds,
    setRevealedCardId,
    setViewData,
    viewData
  } = input;
  const lastGlobalHydrationRequestKeyRef = useRef<string | null>(null);
  const inFlightGlobalHydrationRequestKeyRef = useRef<string | null>(null);
  const lastAcceptedServerDataRef = useRef(data);

  useEffect(() => {
    latestViewDataRef.current = viewData;
  }, [latestViewDataRef, viewData]);

  useEffect(() => {
    if (data === lastAcceptedServerDataRef.current) {
      if (isReviewPageData(data) && globalHydrationRequestKey !== null) {
        lastGlobalHydrationRequestKeyRef.current = globalHydrationRequestKey;
      }
      return;
    }
    lastAcceptedServerDataRef.current = data;

    if (!isReviewPageData(data)) {
      if (
        shouldAdoptServerFirstCandidateData({
          currentData: latestViewDataRef.current,
          nextData: data,
          globalHydrationRequestKey,
          lastGlobalHydrationRequestKey:
            lastGlobalHydrationRequestKeyRef.current
        })
      ) {
        const nextRevealedCardId = resolveHydratedFirstCandidateRevealedCardId({
          currentData: latestViewDataRef.current,
          nextData: data
        });
        latestViewDataRef.current = data;
        setViewData(data);
        setRevealedCardId(nextRevealedCardId);
        setQueueCardIds(data.queueCardIds);
        resetQueuedGradeFailure();
        setClientError(null);
      }
      return;
    }

    const currentViewData = latestViewDataRef.current;
    if (
      !shouldAcceptServerReviewData(
        currentViewData,
        data,
        requestedSelectedCardId,
        isGlobalReview
      )
    ) {
      return;
    }

    const merged = mergeReviewPageData(currentViewData, data);
    if (merged.scope === "global" && globalHydrationRequestKey !== null) {
      lastGlobalHydrationRequestKeyRef.current = globalHydrationRequestKey;
    }
    latestViewDataRef.current = merged;
    setViewData(merged);
    setRevealedCardId(getInitiallyRevealedCardId(merged));
    setQueueCardIds(data.queueCardIds);
    resetQueuedGradeFailure();
    setClientError(null);
  }, [
    data,
    globalHydrationRequestKey,
    isGlobalReview,
    latestViewDataRef,
    requestedSelectedCardId,
    resetQueuedGradeFailure,
    setClientError,
    setQueueCardIds,
    setRevealedCardId,
    setViewData
  ]);

  useEffect(() => {
    if (
      !currentSearchParams ||
      viewData.scope !== "global" ||
      globalHydrationRequestKey === null ||
      lastGlobalHydrationRequestKeyRef.current === globalHydrationRequestKey ||
      inFlightGlobalHydrationRequestKeyRef.current === globalHydrationRequestKey
    ) {
      return;
    }

    let cancelled = false;
    inFlightGlobalHydrationRequestKeyRef.current = globalHydrationRequestKey;

    void loadReviewPageDataSessionAction({
      scope: "global",
      searchParams: currentSearchParams
    })
      .then((nextData) => {
        if (cancelled) {
          return;
        }

        inFlightGlobalHydrationRequestKeyRef.current = null;
        lastGlobalHydrationRequestKeyRef.current = globalHydrationRequestKey;
        const hydrationResult = buildSuccessfulHydrationResult(
          latestViewDataRef.current,
          nextData
        );

        latestViewDataRef.current = hydrationResult.viewData;
        setViewData(hydrationResult.viewData);
        setQueueCardIds(hydrationResult.queueCardIds);
        setClientError(hydrationResult.clientError);
      })
      .catch((error) => {
        console.error(error);

        if (cancelled) {
          return;
        }

        if (
          inFlightGlobalHydrationRequestKeyRef.current ===
          globalHydrationRequestKey
        ) {
          inFlightGlobalHydrationRequestKeyRef.current = null;
        }
        setClientError(
          "Non sono riuscito a completare i dettagli della review. La stage resta disponibile."
        );
      });

    return () => {
      cancelled = true;
      if (
        inFlightGlobalHydrationRequestKeyRef.current ===
        globalHydrationRequestKey
      ) {
        inFlightGlobalHydrationRequestKeyRef.current = null;
      }
    };
  }, [
    currentSearchParams,
    globalHydrationRequestKey,
    latestViewDataRef,
    setClientError,
    setQueueCardIds,
    setViewData,
    viewData.scope
  ]);
}
