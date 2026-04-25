"use client";

import { useCallback, useEffect, useRef } from "react";

import { prefetchReviewCardSessionAction } from "@/actions/review";
import type { ReviewQueueCard } from "@/lib/review-types";

import type { ReviewPageClientData } from "./review-page-state";
import {
  collectQueuedPrefetchCardIds,
  pruneQueuedPrefetchedCardMap,
  pruneQueuedPrefetchingCardIds
} from "./review-page-helpers";

export type ReviewQueuedCardPrefetchInput = {
  activeQueueCardIds: string[];
  isQueueCard: boolean;
  queueCardIds: string[];
  queueIndex: number;
  selectedCard: ReviewPageClientData["selectedCard"];
  serverAdvanceCardIds: ReadonlySet<string>;
};

export function useReviewQueuedCardPrefetch({
  activeQueueCardIds,
  isQueueCard,
  queueCardIds,
  queueIndex,
  selectedCard,
  serverAdvanceCardIds
}: ReviewQueuedCardPrefetchInput) {
  const prefetchBufferRef = useRef<Map<string, ReviewQueueCard>>(new Map());
  const prefetchInFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    prefetchBufferRef.current = pruneQueuedPrefetchedCardMap(
      prefetchBufferRef.current,
      queueCardIds
    );
    prefetchInFlightRef.current = pruneQueuedPrefetchingCardIds(
      prefetchInFlightRef.current,
      queueCardIds
    );
  }, [queueCardIds]);

  useEffect(() => {
    if (!selectedCard || !isQueueCard) {
      return;
    }

    const cardIdsToFetch = collectQueuedPrefetchCardIds({
      bufferSize: 3,
      coveredCardIds: serverAdvanceCardIds,
      prefetchedCardIds: new Set(prefetchBufferRef.current.keys()),
      prefetchingCardIds: prefetchInFlightRef.current,
      queueCardIds: activeQueueCardIds,
      queueIndex
    });

    if (cardIdsToFetch.length === 0) {
      return;
    }

    let cancelled = false;

    for (const cardId of cardIdsToFetch) {
      prefetchInFlightRef.current.add(cardId);

      void prefetchReviewCardSessionAction({ cardId })
        .then((card) => {
          if (cancelled || !card) {
            return;
          }

          prefetchBufferRef.current.set(cardId, card);
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          prefetchInFlightRef.current.delete(cardId);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    activeQueueCardIds,
    isQueueCard,
    queueIndex,
    selectedCard,
    serverAdvanceCardIds
  ]);

  const getPrefetchedCards = useCallback(() => prefetchBufferRef.current, []);

  return {
    getPrefetchedCards
  };
}
