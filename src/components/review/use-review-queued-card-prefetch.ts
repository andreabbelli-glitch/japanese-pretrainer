"use client";

import { useCallback, useEffect, useRef } from "react";

import { prefetchReviewCardsSessionAction } from "@/actions/review";
import { preloadAudioSources } from "@/components/ui/audio-preload";
import type { ReviewQueueCard } from "@/features/review/client";

import type { ReviewPageClientData } from "./review-page-state";
import {
  collectQueuedPrefetchCardIds,
  collectReviewCardAudioSources,
  pruneQueuedPrefetchedCardMap
} from "./review-page-helpers";

export type ReviewQueuedCardPrefetchInput = {
  activeQueueCardIds: string[];
  isQueueCard: boolean;
  queueCardIds: string[];
  queueIndex: number;
  selectedCard: ReviewPageClientData["selectedCard"];
  serverAdvanceCards: ReadonlyArray<ReviewQueueCard>;
  serverAdvanceCardIds: ReadonlySet<string>;
};

export function useReviewQueuedCardPrefetch({
  activeQueueCardIds,
  isQueueCard,
  queueCardIds,
  queueIndex,
  selectedCard,
  serverAdvanceCards,
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
    const serverAdvanceAudioSources =
      collectReviewCardAudioSources(serverAdvanceCards);

    if (serverAdvanceAudioSources.length === 0) {
      return;
    }

    preloadAudioSources(serverAdvanceAudioSources, { role: "next" });
  }, [serverAdvanceCards]);

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

    const requestQueueGeneration = queueGenerationRef.current;
    const requestedCardIdSet = new Set(cardIdsToFetch);

    for (const cardId of cardIdsToFetch) {
      prefetchInFlightRef.current.set(cardId, requestQueueGeneration);
    }

    void prefetchReviewCardsSessionAction({ cardIds: cardIdsToFetch })
      .then((results) => {
        const acceptedCards: ReviewQueueCard[] = [];

        for (const { card, cardId } of results) {
          if (
            !isMountedRef.current ||
            queueGenerationRef.current !== requestQueueGeneration ||
            !card ||
            card.id !== cardId ||
            !requestedCardIdSet.has(cardId) ||
            !queueCardIdSetRef.current.has(cardId)
          ) {
            continue;
          }

          prefetchBufferRef.current.set(cardId, card);
          acceptedCards.push(card);
        }

        const cardAudioSources = collectReviewCardAudioSources(acceptedCards);
        if (cardAudioSources.length > 0) {
          preloadAudioSources(cardAudioSources, { role: "next" });
        }
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        for (const cardId of cardIdsToFetch) {
          if (
            prefetchInFlightRef.current.get(cardId) === requestQueueGeneration
          ) {
            prefetchInFlightRef.current.delete(cardId);
          }
        }
      });
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
