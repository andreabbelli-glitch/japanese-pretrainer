"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db, getMediaBySlug } from "@/db";
import {
  revalidateGlossarySummaryCache,
  revalidateReviewSummaryCache
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
  hydrateReviewCard,
  type ReviewPageData,
  type ReviewQueueCard
} from "@/lib/review";
import {
  createRequestReviewProfiler,
  scheduleReviewProfilerFlush,
  type ReviewProfiler
} from "@/lib/review-profiler";
import { mediaReviewCardHref, mediaStudyHref, reviewHref } from "@/lib/site";

type ReviewRedirectMode = "advance_queue" | "preserve_card" | "stay_detail";
type ReviewSessionRedirectMode = Exclude<ReviewRedirectMode, "stay_detail">;
type ReviewSessionInput = {
  answeredCount: number;
  cardId: string;
  cardMediaSlug?: string;
  extraNewCount: number;
  gradedCardBucket?: ReviewQueueCard["bucket"];
  mediaSlug?: string;
  nextCardId?: string;
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
    mediaSlug
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
    mediaSlug
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
    mediaSlug
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
    mediaSlug
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
  const profiler = await createRequestReviewProfiler({
    label: "action:gradeReviewCardSession",
    meta: {
      cardId: input.cardId,
      nextCardId: input.nextCardId ?? null,
      rating: input.rating,
      scope: input.scope ?? "media"
    }
  });
  scheduleReviewProfilerFlush(profiler);
  const mediaId =
    input.scope === "media" && input.mediaSlug
      ? await profiler.measure("requireMediaIdForSlug", () =>
          requireMediaIdForSlug(input.mediaSlug!)
        )
      : undefined;

  await profiler.measure("applyReviewGrade", () =>
    applyReviewGrade({
      cardId: input.cardId,
      expectedMediaId: mediaId,
      rating: input.rating
    })
  );

  revalidateActiveReviewPaths({
    mediaId,
    mediaSlug: input.mediaSlug ?? input.cardMediaSlug
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

    if (!input.nextCardId) {
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
          extraNewCount: input.extraNewCount
        }
      } satisfies ReviewPageData;
    }

    const nextCardId = input.nextCardId;
    const now = new Date();
    const hydratedCard = await profiler.measure("hydrateReviewCard.next", () =>
      hydrateReviewCard({
        cardId: nextCardId,
        now,
        profiler
      })
    );

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
          extraNewCount: input.extraNewCount
        }
      } satisfies ReviewPageData;
    }
  }

  return profiler.measure("requireReviewPageDataForScope", () =>
    requireReviewPageDataForScope(
      input,
      buildReviewSearchParams({
        answeredCount: input.answeredCount + 1,
        extraNewCount: input.extraNewCount
      }),
      profiler
    )
  );
}

export async function prefetchReviewCardSessionAction(input: {
  cardId: string;
}): Promise<ReviewQueueCard | null> {
  const profiler = await createRequestReviewProfiler({
    label: "action:prefetchReviewCardSession",
    meta: {
      cardId: input.cardId
    }
  });
  scheduleReviewProfilerFlush(profiler);

  return profiler.measure("hydrateReviewCard", () =>
    hydrateReviewCard({
      cardId: input.cardId,
      profiler
    })
  );
}

export async function loadReviewPageDataSessionAction(input: {
  mediaSlug?: string;
  scope: "global" | "media";
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReviewPageData> {
  const profiler = await createRequestReviewProfiler({
    label: "action:loadReviewPageDataSession",
    meta: {
      mediaSlug: input.mediaSlug ?? null,
      scope: input.scope
    }
  });
  scheduleReviewProfilerFlush(profiler);

  return profiler.measure("requireReviewPageDataForScope", () =>
    requireReviewPageDataForScope(
      {
        mediaSlug: input.mediaSlug,
        scope: input.scope
      },
      input.searchParams,
      profiler
    )
  );
}

export async function markLinkedEntryKnownSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  const mediaId =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaIdForSlug(input.mediaSlug)
      : undefined;

  await setLinkedEntryStatusByCard({
    cardId: input.cardId,
    expectedMediaId: mediaId,
    status: "known_manual"
  });

  revalidateEntryStatusPaths({
    mediaId,
    mediaSlug: input.mediaSlug ?? input.cardMediaSlug
  });

  return requireReviewPageDataForScope(
    input,
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: "known",
      redirectMode: input.redirectMode
    })
  );
}

export async function setLinkedEntryLearningSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  const mediaId =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaIdForSlug(input.mediaSlug)
      : undefined;

  await setLinkedEntryStatusByCard({
    cardId: input.cardId,
    expectedMediaId: mediaId,
    status: "learning"
  });

  revalidateEntryStatusPaths({
    mediaId,
    mediaSlug: input.mediaSlug ?? input.cardMediaSlug
  });

  return requireReviewPageDataForScope(
    input,
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: "learning",
      redirectMode: input.redirectMode
    })
  );
}

export async function resetReviewCardSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  const mediaId =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaIdForSlug(input.mediaSlug)
      : undefined;

  await resetReviewCardProgress({
    cardId: input.cardId,
    expectedMediaId: mediaId
  });

  revalidateActiveReviewPaths({
    mediaId,
    mediaSlug: input.mediaSlug ?? input.cardMediaSlug
  });

  return requireReviewPageDataForScope(
    input,
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: "reset",
      redirectMode: input.redirectMode
    })
  );
}

export async function setReviewCardSuspendedSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
    suspended: boolean;
  }
): Promise<ReviewPageData> {
  const mediaId =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaIdForSlug(input.mediaSlug)
      : undefined;

  await setReviewCardSuspended({
    cardId: input.cardId,
    expectedMediaId: mediaId,
    suspended: input.suspended
  });

  revalidateActiveReviewPaths({
    mediaId,
    mediaSlug: input.mediaSlug ?? input.cardMediaSlug
  });

  return requireReviewPageDataForScope(
    input,
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: input.suspended ? "suspended" : "resumed",
      redirectMode: input.redirectMode
    })
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
      redirectMode: input.redirectMode
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
}) {
  revalidateGlossarySummaryCache(input.mediaId);
  revalidateReviewSummaryCache(input.mediaId);
  revalidatePath(reviewHref());

  if (!input.mediaSlug) {
    return;
  }

  revalidatePath(mediaStudyHref(input.mediaSlug, "review"));
}

function revalidateEntryStatusPaths(input: {
  mediaId?: string;
  mediaSlug: string | undefined;
}) {
  revalidateActiveReviewPaths(input);
  revalidatePath("/glossary");

  if (!input.mediaSlug) {
    return;
  }

  revalidatePath(mediaStudyHref(input.mediaSlug, "glossary"));
}

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing form field: ${key}`);
  }

  return value.trim();
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
}) {
  return buildReviewSearchParams({
    answeredCount: input.answeredCount,
    cardId:
      input.cardId && input.redirectMode === "preserve_card"
        ? input.cardId
        : undefined,
    extraNewCount: input.extraNewCount,
    notice: input.notice
  });
}

function buildReviewSearchParams(input: {
  answeredCount: number;
  cardId?: string;
  extraNewCount?: number;
  notice?: string;
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
  profiler?: ReviewProfiler | null
) {
  const data = await getReviewPageData(mediaSlug, searchParams, db, {
    bypassCache: true,
    profiler
  });

  if (!data) {
    throw new Error(`Unable to load review page data for media: ${mediaSlug}`);
  }

  return data;
}

async function requireReviewPageDataForScope(
  input: Pick<ReviewSessionInput, "mediaSlug" | "scope">,
  searchParams: Record<string, string | string[] | undefined>,
  profiler?: ReviewProfiler | null
) {
  if (input.scope === "global") {
    return getGlobalReviewPageData(searchParams, db, {
      bypassCache: true,
      profiler
    });
  }

  if (!input.mediaSlug) {
    throw new Error("Media review scope requires a media slug.");
  }

  return requireReviewPageData(input.mediaSlug, searchParams, profiler);
}

async function requireMediaIdForSlug(mediaSlug: string) {
  const media = await getMediaBySlug(db, mediaSlug);

  if (!media) {
    throw new Error(`Unable to resolve media for slug: ${mediaSlug}`);
  }

  return media.id;
}
