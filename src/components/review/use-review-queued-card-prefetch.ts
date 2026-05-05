"use client";

import { useCallback, useEffect, useRef } from "react";

import { prefetchReviewCardSessionAction } from "@/actions/review";
import type { ReviewQueueCard } from "@/lib/review-types";

import type { ReviewPageClientData } from "./review-page-state";
import {
  collectQueuedPrefetchCardIds,
  pruneQueuedPrefetchedCardMap
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
  const prefetchInFlightRef = useRef<Map<string, number>>(new Map());
  const queueCardIdSetRef = useRef<Set<string>>(new Set(queueCardIds));
  const queueGenerationRef = useRef(0);
  const queueSignatureRef = useRef(buildQueueSignature(queueCardIds));
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const nextQueueCardIdSet = new Set(queueCardIds);
    const nextQueueSignature = buildQueueSignature(queueCardIds);
    if (queueSignatureRef.current !== nextQueueSignature) {
      queueSignatureRef.current = nextQueueSignature;
      queueGenerationRef.current += 1;
    }

    queueCardIdSetRef.current = nextQueueCardIdSet;
    prefetchBufferRef.current = pruneQueuedPrefetchedCardMap(
      prefetchBufferRef.current,
      queueCardIds
    );
    for (const cardId of prefetchInFlightRef.current.keys()) {
      if (!nextQueueCardIdSet.has(cardId)) {
        prefetchInFlightRef.current.delete(cardId);
      }
    }
  }, [queueCardIds]);

  useEffect(() => {
    if (!selectedCard || !isQueueCard) {
      return;
    }

    const cardIdsToFetch = collectQueuedPrefetchCardIds({
      bufferSize: 3,
      coveredCardIds: serverAdvanceCardIds,
      prefetchedCardIds: new Set(prefetchBufferRef.current.keys()),
      prefetchingCardIds: new Set(prefetchInFlightRef.current.keys()),
      queueCardIds: activeQueueCardIds,
      queueIndex
    });

    if (cardIdsToFetch.length === 0) {
      return;
    }

    for (const cardId of cardIdsToFetch) {
      const requestQueueGeneration = queueGenerationRef.current;
      prefetchInFlightRef.current.set(cardId, requestQueueGeneration);

      void prefetchReviewCardSessionAction({ cardId })
        .then((card) => {
          if (
            !isMountedRef.current ||
            queueGenerationRef.current !== requestQueueGeneration ||
            !card ||
            !queueCardIdSetRef.current.has(cardId)
          ) {
            return;
          }

          prefetchBufferRef.current.set(cardId, card);
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          if (
            prefetchInFlightRef.current.get(cardId) === requestQueueGeneration
          ) {
            prefetchInFlightRef.current.delete(cardId);
          }
        });
    }
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

function buildQueueSignature(queueCardIds: string[]) {
  return JSON.stringify(queueCardIds);
}
