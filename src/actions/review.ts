"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";

import { readRequiredString } from "./form-data.ts";
import { db, getMediaBySlug } from "@/db";
import { loadReviewPageDataSession } from "@/lib/review-page-data";
import {
  getMediaBySlugCached,
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
import type { ReviewPageData, ReviewQueueCard } from "@/lib/review-types";
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
  extraNewCount: number;
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

export async function gradeReviewCardAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const rating = readRequiredString(formData, "rating");
  const answeredCount = readCount(formData, "answered");
  const extraNewCount = readCount(formData, "extraNew");
  const mediaId = await requireMediaIdForSlug(mediaSlug);

  await applyReviewGrade({
    cardId,
    expectedMediaId: mediaId,
    rating:
      rating === "again" ||
      rating === "hard" ||
      rating === "good" ||
      rating === "easy"
        ? rating
        : "good"
  });

  revalidateActiveReviewCaches({
    mediaId,
    mediaSlug
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
  const media =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaForSlug(input.mediaSlug!)
      : undefined;

  await applyReviewGrade({
    cardId: input.cardId,
    expectedMediaId: media?.id,
    rating: input.rating
  });
  revalidateActiveReviewCaches(
    await resolveSessionReviewRevalidationInput({
      cardMediaSlug: input.cardMediaSlug,
      mediaSlug: input.mediaSlug,
      resolvedMedia: media,
      scope: input.scope
    })
  );

  if (
    (input.gradedCardBucket === "due" || input.gradedCardBucket === "new") &&
    input.sessionMedia &&
    input.sessionQueue &&
    input.sessionSettings
  ) {
    const updatedQueue = buildIncrementalQueueUpdate(
      input.sessionQueue,
      input.gradedCardBucket
    );

    if (input.nextCardId === null) {
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

    const nextCardId = input.nextCardId;
    if (nextCardId === undefined) {
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
      cardId: nextCardId,
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
  mediaSlug: string | undefined;
}) {
  updateReviewSummaryCache(input.mediaId);
}

function revalidateEntryStatusCaches(input: {
  mediaId?: string;
  mediaSlug: string | undefined;
}) {
  revalidateActiveReviewCaches(input);
  updateGlossarySummaryCache();

  if (input.mediaId) {
    updateGlossarySummaryCache(input.mediaId);
  }
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

  const revalidateInput = {
    mediaId,
    mediaSlug: input.mediaSlug
  };

  if (usesEntryStatusRevalidation(input.kind)) {
    revalidateEntryStatusCaches(revalidateInput);
  } else {
    revalidateActiveReviewCaches(revalidateInput);
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
  const media = await resolveReviewSessionMedia(input);

  await runReviewMutation({
    cardId: input.cardId,
    expectedMediaId: media?.id,
    kind: input.kind,
    suspended: input.suspended
  });
  const revalidateInput = await resolveSessionReviewRevalidationInput({
    cardMediaSlug: input.cardMediaSlug,
    mediaSlug: input.mediaSlug,
    resolvedMedia: media,
    scope: input.scope
  });

  if (usesEntryStatusRevalidation(input.kind)) {
    revalidateEntryStatusCaches(revalidateInput);
  } else {
    revalidateActiveReviewCaches(revalidateInput);
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
    media
  );
}

async function runReviewMutation(input: ReviewMutationInput) {
  switch (input.kind) {
    case "known":
      await setLinkedEntryStatusByCard({
        cardId: input.cardId,
        expectedMediaId: input.expectedMediaId,
        status: "known_manual"
      });
      return;
    case "learning":
      await setLinkedEntryStatusByCard({
        cardId: input.cardId,
        expectedMediaId: input.expectedMediaId,
        status: "learning"
      });
      return;
    case "reset":
      await resetReviewCardProgress({
        cardId: input.cardId,
        expectedMediaId: input.expectedMediaId
      });
      return;
    case "suspended":
      await setReviewCardSuspended({
        cardId: input.cardId,
        expectedMediaId: input.expectedMediaId,
        suspended: input.suspended === true
      });
      return;
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
  resolvedMedia?: Awaited<ReturnType<typeof getMediaBySlug>> & {},
  excludeCardIds?: string[],
  bypassCache = true
) {
  const data = await getReviewPageData(mediaSlug, searchParams, db, {
    bypassCache,
    excludeCardIds,
    resolvedMedia
  });

  if (!data) {
    throw new Error(`Unable to load review page data for media: ${mediaSlug}`);
  }

  return data;
}

async function requireReviewPageDataForScope(
  input: Pick<ReviewSessionInput, "gradedCardIds" | "mediaSlug" | "scope">,
  searchParams: Record<string, string | string[] | undefined>,
  resolvedMedia?: Awaited<ReturnType<typeof getMediaBySlug>> & {},
  bypassCache = true
) {
  const excludeCardIds = input.gradedCardIds;

  if (input.scope === "global") {
    return getGlobalReviewPageData(searchParams, db, {
      bypassCache,
      excludeCardIds
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
    bypassCache
  );
}

async function resolveReviewSessionMedia(
  input: Pick<ReviewSessionInput, "mediaSlug" | "scope">
) {
  return input.scope === "media" && input.mediaSlug
    ? requireMediaForSlug(input.mediaSlug)
    : undefined;
}

async function resolveSessionReviewRevalidationInput(
  input: Pick<
    ReviewSessionInput,
    "cardMediaSlug" | "mediaSlug" | "scope"
  > & {
    resolvedMedia?: Awaited<ReturnType<typeof getMediaBySlug>> & {};
  }
) {
  const media =
    input.scope === "media" && input.resolvedMedia
      ? input.resolvedMedia
      : input.mediaSlug
        ? await getMediaBySlugCached(db, input.mediaSlug)
        : input.cardMediaSlug
          ? await getMediaBySlugCached(db, input.cardMediaSlug)
          : null;

  return {
    mediaId: media?.id,
    mediaSlug: media?.slug
  };
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
