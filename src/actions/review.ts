"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { readRequiredString } from "./form-data.ts";
import { db, getMediaBySlug } from "@/db";
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
  mediaHref,
  mediaReviewCardHref,
  mediaStudyHref,
  reviewHref
} from "@/lib/site";

type ReviewRedirectMode = "advance_queue" | "preserve_card" | "stay_detail";
type ReviewSessionRedirectMode = Exclude<ReviewRedirectMode, "stay_detail">;
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

  revalidateActiveReviewPaths({
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
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const answeredCount = readCount(formData, "answered");
  const extraNewCount = readCount(formData, "extraNew");
  const redirectMode = readRedirectMode(formData);
  const mediaId = await requireMediaIdForSlug(mediaSlug);

  await setLinkedEntryStatusByCard({
    cardId,
    expectedMediaId: mediaId,
    status: "known_manual"
  });

  revalidateEntryStatusPaths({
    mediaId,
    mediaSlug,
    cardId
  });
  redirect(
    buildReviewRedirectUrl({
      answeredCount,
      cardId,
      extraNewCount,
      mediaSlug,
      redirectMode,
      notice: "known"
    })
  );
}

export async function setLinkedEntryLearningAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const answeredCount = readCount(formData, "answered");
  const extraNewCount = readCount(formData, "extraNew");
  const redirectMode = readRedirectMode(formData);
  const mediaId = await requireMediaIdForSlug(mediaSlug);

  await setLinkedEntryStatusByCard({
    cardId,
    expectedMediaId: mediaId,
    status: "learning"
  });

  revalidateEntryStatusPaths({
    mediaId,
    mediaSlug,
    cardId
  });
  redirect(
    buildReviewRedirectUrl({
      answeredCount,
      cardId,
      extraNewCount,
      mediaSlug,
      redirectMode,
      notice: "learning"
    })
  );
}

export async function resetReviewCardAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const answeredCount = readCount(formData, "answered");
  const extraNewCount = readCount(formData, "extraNew");
  const redirectMode = readRedirectMode(formData);
  const mediaId = await requireMediaIdForSlug(mediaSlug);

  await resetReviewCardProgress({
    cardId,
    expectedMediaId: mediaId
  });

  revalidateActiveReviewPaths({
    mediaId,
    mediaSlug,
    cardId
  });
  redirect(
    buildReviewRedirectUrl({
      answeredCount,
      cardId,
      extraNewCount,
      mediaSlug,
      redirectMode,
      notice: "reset"
    })
  );
}

export async function setReviewCardSuspendedAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const answeredCount = readCount(formData, "answered");
  const extraNewCount = readCount(formData, "extraNew");
  const redirectMode = readRedirectMode(formData);
  const suspended = formData.get("suspended") === "true";
  const mediaId = await requireMediaIdForSlug(mediaSlug);

  await setReviewCardSuspended({
    cardId,
    expectedMediaId: mediaId,
    suspended
  });

  revalidateActiveReviewPaths({
    mediaId,
    mediaSlug,
    cardId
  });
  redirect(
    buildReviewRedirectUrl({
      answeredCount,
      cardId,
      extraNewCount,
      mediaSlug,
      redirectMode,
      notice: suspended ? "suspended" : "resumed"
    })
  );
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
  return requireReviewPageDataForScope(
    {
      mediaSlug: input.mediaSlug,
      scope: input.scope
    },
    input.searchParams
  );
}

export async function markLinkedEntryKnownSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  const media =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaForSlug(input.mediaSlug)
      : undefined;

  await setLinkedEntryStatusByCard({
    cardId: input.cardId,
    expectedMediaId: media?.id,
    status: "known_manual"
  });

  return requireReviewPageDataForScope(
    input,
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: "known",
      redirectMode: input.redirectMode,
      segmentId: input.segmentId
    }),
    media
  );
}

export async function setLinkedEntryLearningSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  const media =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaForSlug(input.mediaSlug)
      : undefined;

  await setLinkedEntryStatusByCard({
    cardId: input.cardId,
    expectedMediaId: media?.id,
    status: "learning"
  });

  return requireReviewPageDataForScope(
    input,
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: "learning",
      redirectMode: input.redirectMode,
      segmentId: input.segmentId
    }),
    media
  );
}

export async function resetReviewCardSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  const media =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaForSlug(input.mediaSlug)
      : undefined;

  await resetReviewCardProgress({
    cardId: input.cardId,
    expectedMediaId: media?.id
  });

  return requireReviewPageDataForScope(
    input,
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: "reset",
      redirectMode: input.redirectMode,
      segmentId: input.segmentId
    }),
    media
  );
}

export async function setReviewCardSuspendedSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
    suspended: boolean;
  }
): Promise<ReviewPageData> {
  const media =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaForSlug(input.mediaSlug)
      : undefined;

  await setReviewCardSuspended({
    cardId: input.cardId,
    expectedMediaId: media?.id,
    suspended: input.suspended
  });

  return requireReviewPageDataForScope(
    input,
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: input.suspended ? "suspended" : "resumed",
      redirectMode: input.redirectMode,
      segmentId: input.segmentId
    }),
    media
  );
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
}): Route {
  if (input.redirectMode === "stay_detail" && input.cardId) {
    return mediaReviewCardHref(input.mediaSlug, input.cardId);
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

function revalidateActiveReviewPaths(input: {
  mediaId?: string;
  mediaSlug: string | undefined;
  cardId?: string;
}) {
  revalidateDeferredShellPaths(input.mediaSlug);
  revalidatePath(reviewHref());

  if (!input.mediaSlug) {
    return;
  }

  revalidatePath(mediaStudyHref(input.mediaSlug, "review"));

  if (input.cardId) {
    revalidatePath(mediaReviewCardHref(input.mediaSlug, input.cardId));
  }
}

function revalidateEntryStatusPaths(input: {
  mediaId?: string;
  mediaSlug: string | undefined;
  cardId?: string;
}) {
  revalidateActiveReviewPaths(input);
  revalidatePath("/glossary");

  if (!input.mediaSlug) {
    return;
  }

  revalidatePath(mediaStudyHref(input.mediaSlug, "glossary"));
}

function revalidateDeferredShellPaths(mediaSlug?: string) {
  revalidatePath("/");
  revalidatePath("/media");

  if (!mediaSlug) {
    return;
  }

  revalidatePath(mediaHref(mediaSlug));
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
  excludeCardIds?: string[]
) {
  const data = await getReviewPageData(mediaSlug, searchParams, db, {
    bypassCache: true,
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
  resolvedMedia?: Awaited<ReturnType<typeof getMediaBySlug>> & {}
) {
  const excludeCardIds = input.gradedCardIds;

  if (input.scope === "global") {
    return getGlobalReviewPageData(searchParams, db, {
      bypassCache: true,
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
    excludeCardIds
  );
}

async function requireMediaForSlug(mediaSlug: string) {
  const media = await getMediaBySlug(db, mediaSlug);

  if (!media) {
    throw new Error(`Unable to resolve media for slug: ${mediaSlug}`);
  }

  return media;
}

async function requireMediaIdForSlug(mediaSlug: string) {
  return (await requireMediaForSlug(mediaSlug)).id;
}
