import { db } from "@/db";
import {
  getMediaBySlugCached,
  listMediaCached
} from "@/features/cache/server/data-cache";
import {
  getGlobalReviewPageData,
  getReviewPageData
} from "@/features/review/server/page-data";
import { hydrateReviewCard } from "@/features/review/server/card-hydration";
import type { ReviewGradeResult } from "@/features/review/server/service";
import type { ReviewPageData, ReviewQueueCard } from "@/features/review/types";
import type { ReviewSessionInput } from "@/features/review/types";
import { DEFAULT_REVIEW_LEARN_AHEAD_MINUTES } from "@/features/review/model/queue";
import {
  addReviewStudyDays,
  getReviewStudyDay,
  getReviewStudyDayBoundsForKey
} from "@/features/review/model/study-day";

import { buildReviewSearchParams } from "@/features/navigation/review-session.ts";

export type { ReviewSessionInput } from "@/features/review/types";

export type ResolvedReviewScopeMedia = {
  id: string;
  slug: string;
  title: string;
};

export async function resolvePostGradeReviewSessionPageData(input: {
  gradeResult: Pick<
    ReviewGradeResult,
    "dueAt" | "forcedContrast" | "newState" | "scheduledDays"
  >;
  resolvedMedia?: ResolvedReviewScopeMedia;
  sessionInput: ReviewSessionInput;
}): Promise<ReviewPageData> {
  const sessionInput = input.sessionInput;
  const now = new Date();
  const gradedQueueKind = resolveGradedQueueKind(sessionInput, now);

  if (
    gradedQueueKind !== null &&
    sessionInput.sessionMedia &&
    sessionInput.sessionQueue &&
    sessionInput.sessionSettings
  ) {
    const updatedQueue = buildIncrementalQueueUpdate({
      currentQueue: sessionInput.sessionQueue,
      gradedDueAt: input.gradeResult.dueAt,
      gradedQueueKind,
      gradedScheduledDays: input.gradeResult.scheduledDays,
      gradedState: input.gradeResult.newState,
      now
    });
    const hasAdvanceCandidates =
      (sessionInput.candidateCardIds?.length ?? 0) > 0;
    const hydratedAdvanceCandidate = hasAdvanceCandidates
      ? await resolveHydratedAdvanceCandidate({
          candidateCardIds: sessionInput.candidateCardIds ?? [],
          canonicalCandidateCardIds:
            sessionInput.canonicalCandidateCardIds ?? [],
          canonicalCandidateSnapshot: sessionInput.canonicalCandidateSnapshot,
          now
        })
      : null;

    if (hydratedAdvanceCandidate) {
      return buildReviewSessionPageData({
        advanceCards: [],
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
          reviewStateUpdatedAt:
            hydratedAdvanceCandidate.card.reviewStateUpdatedAt ?? null,
          showAnswer: false
        },
        sessionInput
      });
    }

    if (!hasAdvanceCandidates) {
      if (sessionInput.nextCardId === null) {
        if (
          updatedQueue.queueCount > 0 ||
          shouldRebuildReviewQueueForLearnAhead({
            nextLearningDueAt: updatedQueue.pendingLearningDueAt ?? null,
            now
          })
        ) {
          return requireReviewPageDataForScope(
            sessionInput,
            buildReviewSearchParams({
              answeredCount: sessionInput.answeredCount + 1,
              extraNewAnchorCount: sessionInput.extraNewAnchorCount,
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
        if (
          updatedQueue.queueCount <= 0 &&
          !shouldRebuildReviewQueueForLearnAhead({
            nextLearningDueAt: updatedQueue.pendingLearningDueAt ?? null,
            now
          })
        ) {
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
            extraNewAnchorCount: sessionInput.extraNewAnchorCount,
            extraNewCount: sessionInput.extraNewCount
          }),
          {
            resolvedMedia: input.resolvedMedia
          }
        );
      }

      const hydratedCard = await hydrateReviewCard({
        bypassCache: true,
        cardId: sessionInput.nextCardId,
        now
      });

      if (hydratedCard && isHydratedQueueCandidate(hydratedCard, now)) {
        return buildReviewSessionPageData({
          forcedContrast: input.gradeResult.forcedContrast,
          includeForcedContrast: true,
          queue: updatedQueue,
          selectedCard: hydratedCard,
          selectedCardContext: {
            bucket: hydratedCard.bucket,
            gradePreviews: hydratedCard.gradePreviews,
            isQueueCard: true,
            position: 1,
            remainingCount: Math.max(0, updatedQueue.queueCount - 1),
            reviewStateUpdatedAt: hydratedCard.reviewStateUpdatedAt ?? null,
            showAnswer: false
          },
          sessionInput
        });
      }

      return requireReviewPageDataForScope(
        sessionInput,
        buildReviewSearchParams({
          answeredCount: sessionInput.answeredCount + 1,
          extraNewAnchorCount: sessionInput.extraNewAnchorCount,
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
        extraNewAnchorCount: sessionInput.extraNewAnchorCount,
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
      extraNewAnchorCount: sessionInput.extraNewAnchorCount,
      extraNewCount: sessionInput.extraNewCount,
      segmentId: sessionInput.segmentId
    }),
    {
      resolvedMedia: input.resolvedMedia
    }
  );
}

type GradedQueueKind = "due" | "learn-ahead" | "new";

function resolveGradedQueueKind(
  input: Pick<
    ReviewSessionInput,
    | "gradedCardBucket"
    | "gradedCardDueAt"
    | "gradedCardScheduledDays"
    | "gradedCardState"
  >,
  now: Date
): GradedQueueKind | null {
  if (input.gradedCardBucket === "due" || input.gradedCardBucket === "new") {
    return input.gradedCardBucket;
  }

  return isIntradayLearnAheadCandidate(
    {
      bucket: input.gradedCardBucket,
      dueAt: input.gradedCardDueAt ?? null,
      scheduledDays: input.gradedCardScheduledDays,
      state: input.gradedCardState ?? null
    },
    now
  )
    ? "learn-ahead"
    : null;
}

function resolveScheduledIntradayDueAt(input: {
  dueAt: string | null;
  newState: ReviewGradeResult["newState"];
  scheduledDays: number;
}) {
  return input.scheduledDays === 0 &&
    (input.newState === "learning" || input.newState === "relearning") &&
    input.dueAt
    ? input.dueAt
    : null;
}

function isIntradayLearnAheadCandidate(
  input: {
    bucket: ReviewQueueCard["bucket"] | undefined;
    dueAt: string | null;
    scheduledDays: number | undefined;
    state: ReviewQueueCard["reviewSeedState"]["state"];
  },
  now: Date
) {
  if (
    input.bucket !== "upcoming" ||
    input.scheduledDays !== 0 ||
    (input.state !== "learning" && input.state !== "relearning") ||
    !input.dueAt
  ) {
    return false;
  }

  const dueTime = new Date(input.dueAt).getTime();
  const cutoffTime =
    now.getTime() + DEFAULT_REVIEW_LEARN_AHEAD_MINUTES * 60_000;

  return Number.isFinite(dueTime) && dueTime <= cutoffTime;
}

export async function requireReviewPageDataForScope(
  input: Pick<ReviewSessionInput, "mediaSlug" | "scope">,
  searchParams: Record<string, string | string[] | undefined>,
  options: {
    bypassCache?: boolean;
    resolvedMedia?: ResolvedReviewScopeMedia;
    resolvedMediaRows?: Awaited<ReturnType<typeof listMediaCached>>;
  } = {}
) {
  const bypassCache = options.bypassCache ?? true;

  if (input.scope === "global") {
    return getGlobalReviewPageData(searchParams, db, {
      bypassCache,
      resolvedMediaRows: options.resolvedMediaRows
    });
  }

  if (!input.mediaSlug) {
    throw new Error("Media review scope requires a media slug.");
  }

  return requireReviewPageData(input.mediaSlug, searchParams, {
    bypassCache,
    resolvedMedia: options.resolvedMedia,
    resolvedMediaRows: options.resolvedMediaRows
  });
}

export function shouldRebuildReviewQueueForLearnAhead(input: {
  nextLearningDueAt: string | null;
  now: Date;
}) {
  if (!input.nextLearningDueAt) {
    return false;
  }

  const nextDueTime = new Date(input.nextLearningDueAt).getTime();
  const learnAheadCutoff =
    input.now.getTime() + DEFAULT_REVIEW_LEARN_AHEAD_MINUTES * 60_000;

  return Number.isFinite(nextDueTime) && nextDueTime <= learnAheadCutoff;
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

function buildIncrementalQueueUpdate(input: {
  currentQueue: ReviewPageData["queue"];
  gradedDueAt: string | null;
  gradedQueueKind: GradedQueueKind;
  gradedScheduledDays: number;
  gradedState: ReviewGradeResult["newState"];
  now: Date;
}): ReviewPageData["queue"] {
  const { currentQueue, gradedQueueKind } = input;
  const gradedDueAt = input.gradedDueAt;
  const gradedDueTime = gradedDueAt ? new Date(gradedDueAt).getTime() : NaN;
  const gradedBecomesUpcoming =
    Number.isFinite(gradedDueTime) && gradedDueTime > input.now.getTime();
  const scheduledIntradayDueAt = resolveScheduledIntradayDueAt({
    dueAt: input.gradedDueAt,
    newState: input.gradedState,
    scheduledDays: input.gradedScheduledDays
  });
  const pendingLearningDueAt = resolveEarliestDueAt(
    currentQueue.pendingLearningDueAt ?? null,
    scheduledIntradayDueAt
  );
  const pendingScheduledDueAt = resolveEarliestDueAt(
    currentQueue.pendingScheduledDueAt ?? null,
    gradedDueAt
  );
  const nextDueAt =
    gradedQueueKind === "learn-ahead"
      ? pendingScheduledDueAt
      : resolveEarliestDueAt(currentQueue.nextDueAt ?? null, gradedDueAt);
  const nextLearningDueAt =
    gradedQueueKind === "learn-ahead"
      ? pendingLearningDueAt
      : resolveEarliestDueAt(
          currentQueue.nextLearningDueAt ?? null,
          pendingLearningDueAt
        );

  return {
    ...currentQueue,
    advanceCards: [],
    dueCount:
      gradedQueueKind === "due"
        ? Math.max(0, currentQueue.dueCount - 1)
        : currentQueue.dueCount,
    newAvailableCount:
      gradedQueueKind === "new"
        ? Math.max(0, currentQueue.newAvailableCount - 1)
        : currentQueue.newAvailableCount,
    newQueuedCount:
      gradedQueueKind === "new"
        ? Math.max(0, currentQueue.newQueuedCount - 1)
        : currentQueue.newQueuedCount,
    nextDueAt,
    nextLearningDueAt,
    pendingLearningDueAt,
    pendingScheduledDueAt,
    queueCount: Math.max(0, currentQueue.queueCount - 1),
    tomorrowCount:
      currentQueue.tomorrowCount +
      (gradedBecomesUpcoming && isDueTomorrow(gradedDueAt!, input.now) ? 1 : 0),
    upcomingCount:
      currentQueue.upcomingCount +
      (gradedQueueKind !== "learn-ahead" && gradedBecomesUpcoming ? 1 : 0)
  };
}

function resolveEarliestDueAt(
  currentDueAt: string | null,
  candidateDueAt: string | null
) {
  if (!candidateDueAt) {
    return currentDueAt;
  }

  if (!currentDueAt) {
    return candidateDueAt;
  }

  return candidateDueAt < currentDueAt ? candidateDueAt : currentDueAt;
}

function isDueTomorrow(dueAt: string, now: Date) {
  const { dayEndIso, dayStartIso } = getReviewStudyDayBoundsForKey(
    addReviewStudyDays(getReviewStudyDay(now), 1)
  );

  return dueAt >= dayStartIso && dueAt < dayEndIso;
}

async function resolveHydratedAdvanceCandidate(input: {
  candidateCardIds: string[];
  canonicalCandidateCardIds?: string[];
  canonicalCandidateSnapshot?: ReviewSessionInput["canonicalCandidateSnapshot"];
  now: Date;
}) {
  const canonicalCandidateCardIds =
    input.canonicalCandidateCardIds &&
    input.canonicalCandidateCardIds.length > 0
      ? input.canonicalCandidateCardIds
      : input.candidateCardIds;
  const canonicalCardId = canonicalCandidateCardIds[0];

  if (!canonicalCardId) {
    return null;
  }

  const snapshot = input.canonicalCandidateSnapshot;
  const isLegacySingleCandidate = canonicalCandidateCardIds.length === 1;

  if (!snapshot && !isLegacySingleCandidate) {
    return null;
  }

  const hydratedCard = await hydrateReviewCard({
    bypassCache: true,
    cardId: canonicalCardId,
    now: input.now
  });

  if (!hydratedCard || !isHydratedQueueCandidate(hydratedCard, input.now)) {
    return null;
  }

  if (
    snapshot
      ? !doesHydratedCandidateMatchSnapshot(hydratedCard, snapshot)
      : !isLegacySingleCandidate
  ) {
    return null;
  }

  return {
    card: hydratedCard,
    position: 1
  };
}

function doesHydratedCandidateMatchSnapshot(
  card: ReviewQueueCard,
  snapshot: NonNullable<ReviewSessionInput["canonicalCandidateSnapshot"]>
) {
  return (
    snapshot.cardId === card.id &&
    snapshot.bucket === card.bucket &&
    snapshot.reviewStateUpdatedAt === (card.reviewStateUpdatedAt ?? null) &&
    snapshot.schedulingKey ===
      (card.reviewSeedState.schedulingKey?.trim() || null)
  );
}

function isHydratedQueueCandidate(card: ReviewQueueCard, now: Date) {
  return (
    card.bucket === "due" ||
    card.bucket === "new" ||
    isIntradayLearnAheadCandidate(
      {
        bucket: card.bucket,
        dueAt: card.dueAt,
        scheduledDays: card.reviewSeedState.scheduledDays,
        state: card.reviewSeedState.state
      },
      now
    )
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
      extraNewAnchorCount: input.sessionInput.extraNewAnchorCount ?? null,
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
