"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";

import { readRequiredString } from "./form-data.ts";
import { db } from "@/db";
import { loadReviewPageDataSession } from "@/lib/review-page-data";
import {
  getMediaBySlugCached,
  listMediaCached,
  updateGlossarySummaryCache,
  updateReviewSummaryCache
} from "@/lib/data-cache";
import {
  applyReviewGrade,
  resetReviewCardProgress,
  setLinkedEntryStatusByCard,
  setReviewCardSuspended
} from "@/lib/review-service";
import {
  getGlobalReviewPageData,
  getReviewPageData,
  hydrateReviewCard
} from "@/lib/review";
import type {
  ReviewForcedContrastPayload,
  ReviewPageData,
  ReviewQueueCard
} from "@/lib/review-types";
import {
  appendReturnToParam,
  mediaReviewCardHref,
  mediaStudyHref,
  readInternalHref
} from "@/lib/site";

type ReviewRedirectMode = "advance_queue" | "preserve_card" | "stay_detail";
type ReviewSessionRedirectMode = Exclude<ReviewRedirectMode, "stay_detail">;
type ReviewMutationKind = "known" | "learning" | "reset" | "suspended";
type ReviewSessionInput = {
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
type ReviewMutationInput = {
  cardId: string;
  expectedMediaId?: string;
  kind: ReviewMutationKind;
  suspended?: boolean;
};
type ReviewFormMutationInput = {
  answeredCount: number;
  cardId: string;
  extraNewCount: number;
  mediaSlug: string;
  redirectMode: ReviewRedirectMode;
  returnTo?: Route | null;
  suspended?: boolean;
};
type ReviewSessionMutationInput = ReviewSessionInput & {
  kind: ReviewMutationKind;
  redirectMode: ReviewSessionRedirectMode;
  suspended?: boolean;
};
type ResolvedReviewScopeMedia = {
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

export async function gradeReviewCardAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const rating = readRequiredString(formData, "rating");
  const answeredCount = readCount(formData, "answered");
  const extraNewCount = readCount(formData, "extraNew");
  const expectedUpdatedAt = readOptionalString(formData, "expectedUpdatedAt");
  const mediaId = await requireMediaIdForSlug(mediaSlug);

  await applyReviewGrade({
    cardId,
    expectedMediaId: mediaId,
    expectedUpdatedAt,
    rating:
      rating === "again" ||
      rating === "hard" ||
      rating === "good" ||
      rating === "easy"
        ? rating
        : "good"
  });

  revalidateActiveReviewCaches({
    mediaId
  });
  redirect(
    buildReviewRedirectUrl({
      answeredCount: answeredCount + 1,
      extraNewCount,
      mediaSlug
    })
  );
}

export async function markLinkedEntryKnownAction(formData: FormData) {
  await runReviewFormMutationAction({
    ...readReviewFormMutationInput(formData),
    kind: "known"
  });
}

export async function setLinkedEntryLearningAction(formData: FormData) {
  await runReviewFormMutationAction({
    ...readReviewFormMutationInput(formData),
    kind: "learning"
  });
}

export async function resetReviewCardAction(formData: FormData) {
  await runReviewFormMutationAction({
    ...readReviewFormMutationInput(formData),
    kind: "reset"
  });
}

export async function setReviewCardSuspendedAction(formData: FormData) {
  await runReviewFormMutationAction({
    ...readReviewFormMutationInput(formData, {
      includeSuspended: true
    }),
    kind: "suspended"
  });
}

export async function gradeReviewCardSessionAction(
  input: ReviewSessionInput & {
    rating: "again" | "hard" | "good" | "easy";
  }
): Promise<ReviewPageData> {
  const media = await resolveReviewSessionMedia(input);
  const forcedContrast =
    input.forcedKanjiClashContrast ?? input.forcedContrast;

  const gradeResult = await applyReviewGrade({
    cardId: input.cardId,
    expectedMediaId: media?.id,
    expectedUpdatedAt: input.expectedUpdatedAt,
    forcedContrast,
    forcedContrastMediaSlug: input.mediaSlug,
    forcedContrastScope: input.scope === "media" ? "media" : "global",
    rating: input.rating
  });
  revalidateActiveReviewCaches({ mediaId: gradeResult.mediaId });

  if (
    (input.gradedCardBucket === "due" || input.gradedCardBucket === "new") &&
    input.sessionMedia &&
    input.sessionQueue &&
    input.sessionSettings
  ) {
    const now = new Date();
    const updatedQueue = buildIncrementalQueueUpdate(
      input.sessionQueue,
      input.gradedCardBucket
    );
    const hydratedAdvanceCandidate = await resolveHydratedAdvanceCandidate({
      candidateCardIds: input.candidateCardIds ?? [],
      canonicalCandidateCardIds: input.canonicalCandidateCardIds ?? [],
      nextCardId: input.nextCardId,
      now
    });
    const hasAdvanceCandidates = (input.candidateCardIds?.length ?? 0) > 0;

    if (hydratedAdvanceCandidate) {
      const advanceCards = await hydrateReviewAdvanceCards({
        canonicalCandidateCardIds:
          input.canonicalCandidateCardIds ?? input.candidateCardIds ?? [],
        hydratedCardOutcomes: hydratedAdvanceCandidate.hydratedCardOutcomes,
        now,
        selectedQueuePosition: hydratedAdvanceCandidate.position
      });

      return {
        scope: input.scope === "global" ? "global" : "media",
        media: input.sessionMedia,
        settings: input.sessionSettings,
        queue: {
          ...updatedQueue,
          advanceCards
        },
        queueCardIds: [],
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
        session: {
          answeredCount: input.answeredCount + 1,
          extraNewCount: input.extraNewCount,
          forcedContrast: gradeResult.forcedContrast,
          segmentId: input.segmentId
        }
      } satisfies ReviewPageData;
    }

    if (!hasAdvanceCandidates) {
      if (input.nextCardId === null) {
        if (updatedQueue.queueCount > 0) {
          return requireReviewPageDataForScope(
            input,
            buildReviewSearchParams({
              answeredCount: input.answeredCount + 1,
              extraNewCount: input.extraNewCount,
              segmentId: input.segmentId
            }),
            media
          );
        }

        return {
          scope: input.scope === "global" ? "global" : "media",
          media: input.sessionMedia,
          settings: input.sessionSettings,
          queue: updatedQueue,
          queueCardIds: [],
          selectedCard: null,
          selectedCardContext: {
            bucket: null,
            gradePreviews: [],
            isQueueCard: false,
            position: null,
            remainingCount: 0,
            showAnswer: false
          },
          session: {
            answeredCount: input.answeredCount + 1,
            extraNewCount: input.extraNewCount,
            forcedContrast: gradeResult.forcedContrast,
            segmentId: input.segmentId
          }
        } satisfies ReviewPageData;
      }

      if (input.nextCardId === undefined) {
        if (updatedQueue.queueCount <= 0) {
          return {
            scope: input.scope === "global" ? "global" : "media",
            media: input.sessionMedia,
            settings: input.sessionSettings,
            queue: updatedQueue,
            queueCardIds: [],
            selectedCard: null,
            selectedCardContext: {
              bucket: null,
              gradePreviews: [],
              isQueueCard: false,
              position: null,
              remainingCount: 0,
              showAnswer: false
            },
            session: {
              answeredCount: input.answeredCount + 1,
              extraNewCount: input.extraNewCount,
              segmentId: input.segmentId
            }
          } satisfies ReviewPageData;
        }

        return requireReviewPageDataForScope(
          input,
          buildReviewSearchParams({
            answeredCount: input.answeredCount + 1,
            extraNewCount: input.extraNewCount
          }),
          media
        );
      }

      const now = new Date();
      const hydratedCard = await hydrateReviewCard({
        cardId: input.nextCardId,
        now
      });

      if (hydratedCard) {
        return {
          scope: input.scope === "global" ? "global" : "media",
          media: input.sessionMedia,
          settings: input.sessionSettings,
          queue: updatedQueue,
          queueCardIds: [],
          selectedCard: hydratedCard,
          selectedCardContext: {
            bucket: hydratedCard.bucket,
            gradePreviews: hydratedCard.gradePreviews,
            isQueueCard: true,
            position: 1,
            remainingCount: Math.max(0, updatedQueue.queueCount - 1),
            showAnswer: false
          },
          session: {
            answeredCount: input.answeredCount + 1,
            extraNewCount: input.extraNewCount,
            segmentId: input.segmentId
          }
        } satisfies ReviewPageData;
      }

      return requireReviewPageDataForScope(
        input,
        buildReviewSearchParams({
          answeredCount: input.answeredCount + 1,
          extraNewCount: input.extraNewCount,
          segmentId: input.segmentId
        }),
        media
      );
    }

    return requireReviewPageDataForScope(
      input,
      buildReviewSearchParams({
        answeredCount: input.answeredCount + 1,
        extraNewCount: input.extraNewCount,
        segmentId: input.segmentId
      }),
      media
    );
  }

  return requireReviewPageDataForScope(
    input,
    buildReviewSearchParams({
      answeredCount: input.answeredCount + 1,
      extraNewCount: input.extraNewCount,
      segmentId: input.segmentId
    }),
    media
  );
}

export async function prefetchReviewCardSessionAction(input: {
  cardId: string;
}): Promise<ReviewQueueCard | null> {
  return hydrateReviewCard({
    cardId: input.cardId
  });
}

export async function loadReviewPageDataSessionAction(input: {
  mediaSlug?: string;
  scope: "global" | "media";
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReviewPageData> {
  return loadReviewPageDataSession(input, db);
}

export async function markLinkedEntryKnownSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  return runReviewSessionMutationAction({
    ...input,
    kind: "known"
  });
}

export async function setLinkedEntryLearningSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  return runReviewSessionMutationAction({
    ...input,
    kind: "learning"
  });
}

export async function resetReviewCardSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  return runReviewSessionMutationAction({
    ...input,
    kind: "reset"
  });
}

export async function setReviewCardSuspendedSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
    suspended: boolean;
  }
): Promise<ReviewPageData> {
  return runReviewSessionMutationAction({
    ...input,
    kind: "suspended"
  });
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

function buildReviewRedirectUrl(input: {
  answeredCount: number;
  cardId?: string;
  extraNewCount?: number;
  mediaSlug: string;
  redirectMode?: ReviewRedirectMode;
  notice?: string;
  segmentId?: string | null;
  returnTo?: Route | null;
}): Route {
  if (input.redirectMode === "stay_detail" && input.cardId) {
    return appendReturnToParam(
      mediaReviewCardHref(input.mediaSlug, input.cardId),
      input.returnTo
    );
  }

  const params = new URLSearchParams(
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: input.notice,
      redirectMode: input.redirectMode,
      segmentId: input.segmentId
    })
  );

  const baseHref = mediaStudyHref(input.mediaSlug, "review");

  return (
    params.size > 0 ? `${baseHref}?${params.toString()}` : baseHref
  ) as Route;
}

function revalidateActiveReviewCaches(input: {
  mediaId?: string;
}) {
  updateReviewSummaryCache(input.mediaId);
}

function revalidateEntryStatusCaches(input: {
  mediaId?: string;
}) {
  revalidateActiveReviewCaches(input);
  updateGlossarySummaryCache();

  if (input.mediaId) {
    updateGlossarySummaryCache(input.mediaId);
  }
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

function readReviewFormMutationInput(
  formData: FormData,
  options?: { includeSuspended?: boolean }
): ReviewFormMutationInput {
  return {
    answeredCount: readCount(formData, "answered"),
    cardId: readRequiredString(formData, "cardId"),
    extraNewCount: readCount(formData, "extraNew"),
    mediaSlug: readRequiredString(formData, "mediaSlug"),
    redirectMode: readRedirectMode(formData),
    returnTo: readInternalHref(formData.get("returnTo")?.toString()),
    suspended: options?.includeSuspended
      ? formData.get("suspended") === "true"
      : undefined
  };
}

async function runReviewFormMutationAction(
  input: ReviewFormMutationInput & { kind: ReviewMutationKind }
) {
  const mediaId = await requireMediaIdForSlug(input.mediaSlug);

  await runReviewMutation({
    cardId: input.cardId,
    expectedMediaId: mediaId,
    kind: input.kind,
    suspended: input.suspended
  });

  if (usesEntryStatusRevalidation(input.kind)) {
    revalidateEntryStatusCaches({ mediaId });
  } else {
    revalidateActiveReviewCaches({ mediaId });
  }

  redirect(
    buildReviewRedirectUrl({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      mediaSlug: input.mediaSlug,
      notice: getReviewMutationNotice(input.kind, input.suspended),
      redirectMode: input.redirectMode,
      returnTo: input.returnTo
    })
  );
}

async function runReviewSessionMutationAction(
  input: ReviewSessionMutationInput
): Promise<ReviewPageData> {
  const mediaRowsPromise = listMediaCached(db);
  const media = await resolveReviewSessionMedia(input);

  const mutationResult = await runReviewMutation({
    cardId: input.cardId,
    expectedMediaId: media?.id,
    kind: input.kind,
    suspended: input.suspended
  });

  if (usesEntryStatusRevalidation(input.kind)) {
    revalidateEntryStatusCaches({ mediaId: mutationResult.mediaId });
  } else {
    revalidateActiveReviewCaches({ mediaId: mutationResult.mediaId });
  }

  return requireReviewPageDataForScope(
    input,
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: getReviewMutationNotice(input.kind, input.suspended),
      redirectMode: input.redirectMode,
      segmentId: input.segmentId
    }),
    media,
    true,
    await mediaRowsPromise
  );
}

async function runReviewMutation(input: ReviewMutationInput) {
  switch (input.kind) {
    case "known":
      return setLinkedEntryStatusByCard({
        cardId: input.cardId,
        expectedMediaId: input.expectedMediaId,
        status: "known_manual"
      });
    case "learning":
      return setLinkedEntryStatusByCard({
        cardId: input.cardId,
        expectedMediaId: input.expectedMediaId,
        status: "learning"
      });
    case "reset":
      return resetReviewCardProgress({
        cardId: input.cardId,
        expectedMediaId: input.expectedMediaId
      });
    case "suspended":
      return setReviewCardSuspended({
        cardId: input.cardId,
        expectedMediaId: input.expectedMediaId,
        suspended: input.suspended === true
      });
  }
}

function usesEntryStatusRevalidation(kind: ReviewMutationKind) {
  return kind === "known" || kind === "learning";
}

function getReviewMutationNotice(
  kind: ReviewMutationKind,
  suspended?: boolean
) {
  switch (kind) {
    case "known":
      return "known";
    case "learning":
      return "learning";
    case "reset":
      return "reset";
    case "suspended":
      return suspended ? "suspended" : "resumed";
  }
}


function readCount(formData: FormData, key: string) {
  const raw = formData.get(key);
  const parsed =
    typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  const normalized = typeof value === "string" ? value.trim() : "";

  return normalized.length > 0 ? normalized : undefined;
}

function readRedirectMode(formData: FormData): ReviewRedirectMode {
  const value = formData.get("redirectMode");

  return value === "preserve_card" || value === "stay_detail"
    ? value
    : "advance_queue";
}

function buildRedirectSearchParams(input: {
  answeredCount: number;
  cardId?: string;
  extraNewCount?: number;
  notice?: string;
  redirectMode?: ReviewRedirectMode;
  segmentId?: string | null;
}) {
  return buildReviewSearchParams({
    answeredCount: input.answeredCount,
    cardId:
      input.cardId && input.redirectMode === "preserve_card"
        ? input.cardId
        : undefined,
    extraNewCount: input.extraNewCount,
    notice: input.notice,
    segmentId: input.segmentId
  });
}

function buildReviewSearchParams(input: {
  answeredCount: number;
  cardId?: string;
  extraNewCount?: number;
  notice?: string;
  segmentId?: string | null;
  showAnswer?: boolean;
}) {
  const params: Record<string, string> = {};

  if (input.answeredCount > 0) {
    params.answered = String(input.answeredCount);
  }

  if (input.cardId) {
    params.card = input.cardId;
  }

  if (input.extraNewCount && input.extraNewCount > 0) {
    params.extraNew = String(input.extraNewCount);
  }

  if (input.segmentId) {
    params.segment = input.segmentId;
  }

  if (input.notice) {
    params.notice = input.notice;
  }

  if (input.showAnswer) {
    params.show = "answer";
  }

  return params;
}

async function requireReviewPageData(
  mediaSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
  resolvedMedia?: ResolvedReviewScopeMedia,
  excludeCardIds?: string[],
  bypassCache = true,
  resolvedMediaRows?: Awaited<ReturnType<typeof listMediaCached>>
) {
  const data = await getReviewPageData(mediaSlug, searchParams, db, {
    bypassCache,
    excludeCardIds,
    resolvedMedia,
    resolvedMediaRows
  });

  if (!data) {
    throw new Error(`Unable to load review page data for media: ${mediaSlug}`);
  }

  return data;
}

async function requireReviewPageDataForScope(
  input: Pick<ReviewSessionInput, "gradedCardIds" | "mediaSlug" | "scope">,
  searchParams: Record<string, string | string[] | undefined>,
  resolvedMedia?: ResolvedReviewScopeMedia,
  bypassCache = true,
  resolvedMediaRows?: Awaited<ReturnType<typeof listMediaCached>>
) {
  const excludeCardIds = input.gradedCardIds;

  if (input.scope === "global") {
    return getGlobalReviewPageData(searchParams, db, {
      bypassCache,
      excludeCardIds,
      resolvedMediaRows
    });
  }

  if (!input.mediaSlug) {
    throw new Error("Media review scope requires a media slug.");
  }

  return requireReviewPageData(
    input.mediaSlug,
    searchParams,
    resolvedMedia,
    excludeCardIds,
    bypassCache,
    resolvedMediaRows
  );
}

async function resolveReviewSessionMedia(
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

async function requireMediaForSlug(mediaSlug: string) {
  const media = await getMediaBySlugCached(db, mediaSlug);

  if (!media) {
    throw new Error(`Unable to resolve media for slug: ${mediaSlug}`);
  }

  return media;
}

async function requireMediaIdForSlug(mediaSlug: string) {
  return (await requireMediaForSlug(mediaSlug)).id;
}
