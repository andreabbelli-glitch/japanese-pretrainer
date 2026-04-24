import { db } from "@/db";
import {
  getMediaBySlugCached,
  listMediaCached
} from "@/lib/data-cache";
import {
  getGlobalReviewPageData,
  getReviewPageData,
  hydrateReviewCard
} from "@/lib/review";
import type { ReviewGradeResult } from "@/lib/review-service";
import type {
  ReviewForcedContrastPayload,
  ReviewPageData,
  ReviewQueueCard
} from "@/lib/review-types";

import { buildReviewSearchParams } from "./site/review-session.ts";

export type ReviewSessionInput = {
  answeredCount: number;
  cardId: string;
  cardMediaSlug?: string;
  candidateCardIds?: string[];
  canonicalCandidateCardIds?: string[];
  extraNewCount: number;
  expectedUpdatedAt?: string | null;
  forcedContrast?: ReviewForcedContrastPayload;
  forcedKanjiClashContrast?: ReviewForcedContrastPayload;
  gradedCardBucket?: ReviewQueueCard["bucket"];
  gradedCardIds?: string[];
  mediaSlug?: string;
  nextCardId?: string | null;
  segmentId?: string | null;
  sessionMedia?: ReviewPageData["media"];
  sessionQueue?: ReviewPageData["queue"];
  sessionSettings?: ReviewPageData["settings"];
  scope?: "global" | "media";
};

export type ResolvedReviewScopeMedia = {
  id: string;
  slug: string;
  title: string;
};

type HydratedReviewCardOutcome =
  | {
      card: ReviewQueueCard | null;
    }
  | {
      error: unknown;
    };

export async function resolvePostGradeReviewSessionPageData(input: {
  gradeResult: Pick<ReviewGradeResult, "forcedContrast">;
  resolvedMedia?: ResolvedReviewScopeMedia;
  sessionInput: ReviewSessionInput;
}): Promise<ReviewPageData> {
  const sessionInput = input.sessionInput;

  if (
    (sessionInput.gradedCardBucket === "due" ||
      sessionInput.gradedCardBucket === "new") &&
    sessionInput.sessionMedia &&
    sessionInput.sessionQueue &&
    sessionInput.sessionSettings
  ) {
    const now = new Date();
    const updatedQueue = buildIncrementalQueueUpdate(
      sessionInput.sessionQueue,
      sessionInput.gradedCardBucket
    );
    const hydratedAdvanceCandidate = await resolveHydratedAdvanceCandidate({
      candidateCardIds: sessionInput.candidateCardIds ?? [],
      canonicalCandidateCardIds:
        sessionInput.canonicalCandidateCardIds ?? [],
      nextCardId: sessionInput.nextCardId,
      now
    });
    const hasAdvanceCandidates =
      (sessionInput.candidateCardIds?.length ?? 0) > 0;

    if (hydratedAdvanceCandidate) {
      const advanceCards = await hydrateReviewAdvanceCards({
        canonicalCandidateCardIds:
          sessionInput.canonicalCandidateCardIds ??
          sessionInput.candidateCardIds ??
          [],
        hydratedCardOutcomes: hydratedAdvanceCandidate.hydratedCardOutcomes,
        now,
        selectedQueuePosition: hydratedAdvanceCandidate.position
      });

      return buildReviewSessionPageData({
        advanceCards,
        forcedContrast: input.gradeResult.forcedContrast,
        includeForcedContrast: true,
        queue: updatedQueue,
        selectedCard: hydratedAdvanceCandidate.card,
        selectedCardContext: {
          bucket: hydratedAdvanceCandidate.card.bucket,
          gradePreviews: hydratedAdvanceCandidate.card.gradePreviews,
          isQueueCard: true,
          position: hydratedAdvanceCandidate.position,
          remainingCount: Math.max(
            0,
            updatedQueue.queueCount - hydratedAdvanceCandidate.position
          ),
          showAnswer: false
        },
        sessionInput
      });
    }

    if (!hasAdvanceCandidates) {
      if (sessionInput.nextCardId === null) {
        if (updatedQueue.queueCount > 0) {
          return requireReviewPageDataForScope(
            sessionInput,
            buildReviewSearchParams({
              answeredCount: sessionInput.answeredCount + 1,
              extraNewCount: sessionInput.extraNewCount,
              segmentId: sessionInput.segmentId
            }),
            {
              resolvedMedia: input.resolvedMedia
            }
          );
        }

        return buildReviewSessionPageData({
          forcedContrast: input.gradeResult.forcedContrast,
          includeForcedContrast: true,
          queue: updatedQueue,
          selectedCard: null,
          selectedCardContext: emptySelectedCardContext(),
          sessionInput
        });
      }

      if (sessionInput.nextCardId === undefined) {
        if (updatedQueue.queueCount <= 0) {
          return buildReviewSessionPageData({
            queue: updatedQueue,
            selectedCard: null,
            selectedCardContext: emptySelectedCardContext(),
            sessionInput
          });
        }

        return requireReviewPageDataForScope(
          sessionInput,
          buildReviewSearchParams({
            answeredCount: sessionInput.answeredCount + 1,
            extraNewCount: sessionInput.extraNewCount
          }),
          {
            resolvedMedia: input.resolvedMedia
          }
        );
      }

      const now = new Date();
      const hydratedCard = await hydrateReviewCard({
        cardId: sessionInput.nextCardId,
        now
      });

      if (hydratedCard) {
        return buildReviewSessionPageData({
          queue: updatedQueue,
          selectedCard: hydratedCard,
          selectedCardContext: {
            bucket: hydratedCard.bucket,
            gradePreviews: hydratedCard.gradePreviews,
            isQueueCard: true,
            position: 1,
            remainingCount: Math.max(0, updatedQueue.queueCount - 1),
            showAnswer: false
          },
          sessionInput
        });
      }

      return requireReviewPageDataForScope(
        sessionInput,
        buildReviewSearchParams({
          answeredCount: sessionInput.answeredCount + 1,
          extraNewCount: sessionInput.extraNewCount,
          segmentId: sessionInput.segmentId
        }),
        {
          resolvedMedia: input.resolvedMedia
        }
      );
    }

    return requireReviewPageDataForScope(
      sessionInput,
      buildReviewSearchParams({
        answeredCount: sessionInput.answeredCount + 1,
        extraNewCount: sessionInput.extraNewCount,
        segmentId: sessionInput.segmentId
      }),
      {
        resolvedMedia: input.resolvedMedia
      }
    );
  }

  return requireReviewPageDataForScope(
    sessionInput,
    buildReviewSearchParams({
      answeredCount: sessionInput.answeredCount + 1,
      extraNewCount: sessionInput.extraNewCount,
      segmentId: sessionInput.segmentId
    }),
    {
      resolvedMedia: input.resolvedMedia
    }
  );
}

export async function requireReviewPageDataForScope(
  input: Pick<ReviewSessionInput, "gradedCardIds" | "mediaSlug" | "scope">,
  searchParams: Record<string, string | string[] | undefined>,
  options: {
    bypassCache?: boolean;
    resolvedMedia?: ResolvedReviewScopeMedia;
    resolvedMediaRows?: Awaited<ReturnType<typeof listMediaCached>>;
  } = {}
) {
  const excludeCardIds = input.gradedCardIds;
  const bypassCache = options.bypassCache ?? true;

  if (input.scope === "global") {
    return getGlobalReviewPageData(searchParams, db, {
      bypassCache,
      excludeCardIds,
      resolvedMediaRows: options.resolvedMediaRows
    });
  }

  if (!input.mediaSlug) {
    throw new Error("Media review scope requires a media slug.");
  }

  return requireReviewPageData(input.mediaSlug, searchParams, {
    bypassCache,
    excludeCardIds,
    resolvedMedia: options.resolvedMedia,
    resolvedMediaRows: options.resolvedMediaRows
  });
}

export async function resolveReviewSessionMedia(
  input: Pick<ReviewSessionInput, "mediaSlug" | "scope" | "sessionMedia">
) {
  if (input.scope !== "media" || !input.mediaSlug) {
    return undefined;
  }

  const sessionMedia = input.sessionMedia;

  if (sessionMedia?.id && sessionMedia.slug === input.mediaSlug) {
    return {
      id: sessionMedia.id,
      slug: sessionMedia.slug,
      title: sessionMedia.title
    } satisfies ResolvedReviewScopeMedia;
  }

  return requireMediaForSlug(input.mediaSlug);
}

export async function requireMediaForSlug(mediaSlug: string) {
  const media = await getMediaBySlugCached(db, mediaSlug);

  if (!media) {
    throw new Error(`Unable to resolve media for slug: ${mediaSlug}`);
  }

  return media;
}

export async function requireMediaIdForSlug(mediaSlug: string) {
  return (await requireMediaForSlug(mediaSlug)).id;
}

function buildIncrementalQueueUpdate(
  currentQueue: ReviewPageData["queue"],
  gradedCardBucket: ReviewQueueCard["bucket"]
): ReviewPageData["queue"] {
  const isQueuedBucket =
    gradedCardBucket === "due" || gradedCardBucket === "new";

  return {
    ...currentQueue,
    advanceCards: [],
    dueCount:
      gradedCardBucket === "due"
        ? Math.max(0, currentQueue.dueCount - 1)
        : currentQueue.dueCount,
    newAvailableCount:
      gradedCardBucket === "new"
        ? Math.max(0, currentQueue.newAvailableCount - 1)
        : currentQueue.newAvailableCount,
    newQueuedCount:
      gradedCardBucket === "new"
        ? Math.max(0, currentQueue.newQueuedCount - 1)
        : currentQueue.newQueuedCount,
    queueCount: Math.max(0, currentQueue.queueCount - (isQueuedBucket ? 1 : 0))
  };
}

async function resolveHydratedAdvanceCandidate(input: {
  candidateCardIds: string[];
  canonicalCandidateCardIds?: string[];
  nextCardId?: string | null;
  now: Date;
}) {
  const canonicalCandidateCardIds =
    input.canonicalCandidateCardIds && input.canonicalCandidateCardIds.length > 0
      ? input.canonicalCandidateCardIds
      : input.candidateCardIds;
  const orderedCardIds = [
    ...new Set([
      ...(input.nextCardId ? [input.nextCardId] : []),
      ...input.candidateCardIds
    ])
  ];
  const hydratedCardOutcomes = new Map(
    orderedCardIds.map((cardId) => [
      cardId,
      loadHydratedReviewCardOutcome(cardId, input.now)
    ] as const)
  );

  for (const [index, cardId] of orderedCardIds.entries()) {
    const outcome = await hydratedCardOutcomes.get(cardId)!;

    if ("error" in outcome) {
      throw outcome.error;
    }

    const hydratedCard = outcome.card;

    if (hydratedCard) {
      const canonicalQueuePosition = canonicalCandidateCardIds.indexOf(cardId);

      return {
        card: hydratedCard,
        hydratedCardOutcomes,
        position:
          canonicalQueuePosition >= 0 ? canonicalQueuePosition + 1 : index + 1
      };
    }
  }

  return null;
}

async function hydrateReviewAdvanceCards(input: {
  canonicalCandidateCardIds: string[];
  hydratedCardOutcomes?: ReadonlyMap<string, Promise<HydratedReviewCardOutcome>>;
  now: Date;
  selectedQueuePosition: number;
}) {
  const advanceCardIds = input.canonicalCandidateCardIds.slice(
    input.selectedQueuePosition,
    input.selectedQueuePosition + 3
  );

  if (advanceCardIds.length === 0) {
    return [];
  }

  const hydratedCards = await Promise.all(
    advanceCardIds.map(async (cardId) => {
      const outcome =
        (await input.hydratedCardOutcomes?.get(cardId)) ??
        (await loadHydratedReviewCardOutcome(cardId, input.now));

      if ("error" in outcome) {
        throw outcome.error;
      }

      return outcome.card;
    })
  );

  return hydratedCards.filter(
    (card): card is ReviewQueueCard => card !== null
  );
}

function loadHydratedReviewCardOutcome(cardId: string, now: Date) {
  return hydrateReviewCard({
    cardId,
    now
  })
    .then(
      (card) =>
        ({
          card
        }) satisfies HydratedReviewCardOutcome
    )
    .catch(
      (error) =>
        ({
          error
        }) satisfies HydratedReviewCardOutcome
    );
}

async function requireReviewPageData(
  mediaSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
  options: {
    bypassCache: boolean;
    excludeCardIds?: string[];
    resolvedMedia?: ResolvedReviewScopeMedia;
    resolvedMediaRows?: Awaited<ReturnType<typeof listMediaCached>>;
  }
) {
  const data = await getReviewPageData(mediaSlug, searchParams, db, {
    bypassCache: options.bypassCache,
    excludeCardIds: options.excludeCardIds,
    resolvedMedia: options.resolvedMedia,
    resolvedMediaRows: options.resolvedMediaRows
  });

  if (!data) {
    throw new Error(`Unable to load review page data for media: ${mediaSlug}`);
  }

  return data;
}

function buildReviewSessionPageData(input: {
  advanceCards?: ReviewQueueCard[];
  forcedContrast?: ReviewGradeResult["forcedContrast"];
  includeForcedContrast?: boolean;
  queue: ReviewPageData["queue"];
  selectedCard: ReviewQueueCard | null;
  selectedCardContext: ReviewPageData["selectedCardContext"];
  sessionInput: ReviewSessionInput;
}): ReviewPageData {
  return {
    scope: input.sessionInput.scope === "global" ? "global" : "media",
    media: input.sessionInput.sessionMedia!,
    settings: input.sessionInput.sessionSettings!,
    queue: {
      ...input.queue,
      advanceCards: input.advanceCards ?? input.queue.advanceCards
    },
    queueCardIds: [],
    selectedCard: input.selectedCard,
    selectedCardContext: input.selectedCardContext,
    session: {
      answeredCount: input.sessionInput.answeredCount + 1,
      extraNewCount: input.sessionInput.extraNewCount,
      ...(input.includeForcedContrast
        ? {
            forcedContrast: input.forcedContrast
          }
        : {}),
      segmentId: input.sessionInput.segmentId
    }
  } satisfies ReviewPageData;
}

function emptySelectedCardContext(): ReviewPageData["selectedCardContext"] {
  return {
    bucket: null,
    gradePreviews: [],
    isQueueCard: false,
    position: null,
    remainingCount: 0,
    showAnswer: false
  };
}
