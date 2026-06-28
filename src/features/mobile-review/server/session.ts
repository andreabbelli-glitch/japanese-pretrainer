import { db, type DatabaseClient } from "@/db";
import {
  revalidateConsolidationSummaryCache,
  revalidateReviewSummaryCache
} from "@/features/cache/server/data-cache";
import {
  applyReviewGrade,
  getGlobalReviewPageLoadResult
} from "@/features/review/server";
import type {
  ReviewPageData,
  ReviewQueueCard
} from "@/features/review/types";
import type { ReviewRating } from "@/features/review/model/scheduler";

export type MobileReviewCard = {
  back: string;
  cardId: string;
  effectiveState: string;
  entries: Array<{
    kind: string;
    label: string;
    meaning: string;
  }>;
  exampleIt?: string;
  exampleJp?: string;
  front: string;
  mediaSlug: string;
  mediaTitle: string;
  notes?: string;
  pronunciations: Array<{
    kind: string;
    label: string;
    meaning: string;
  }>;
  reviewStateUpdatedAt?: string | null;
};

export type MobileReviewSession = {
  generatedAt: string;
  ok: true;
  queue: {
    dueCount: number;
    nextDueAt: string | null;
    queueCount: number;
    queueLabel: string;
    upcomingCount: number;
  };
  selectedCard: MobileReviewCard | null;
  source: "live";
};

export type MobileReviewGradeResult = {
  grade: {
    cardId: string;
    dueAt: string;
    newState: string;
    previousState: string;
    rating: ReviewRating;
  };
  ok: true;
  session: MobileReviewSession;
};

export async function loadMobileReviewSession(
  database: DatabaseClient = db
): Promise<MobileReviewSession> {
  const loadResult = await getGlobalReviewPageLoadResult({}, database, {
    bypassCache: true
  });
  const generatedAt = new Date().toISOString();

  if (loadResult.kind !== "ready") {
    return {
      generatedAt,
      ok: true,
      queue: {
        dueCount: 0,
        nextDueAt: null,
        queueCount: 0,
        queueLabel:
          loadResult.kind === "empty-media"
            ? "Non ci sono ancora media importati."
            : "Non ci sono ancora card attive.",
        upcomingCount: 0
      },
      selectedCard: null,
      source: "live"
    };
  }

  return mapReviewPageDataToMobileSession(loadResult.data, generatedAt);
}

export async function gradeMobileReviewCard(input: {
  cardId: string;
  database?: DatabaseClient;
  expectedUpdatedAt?: string | null;
  rating: ReviewRating;
  responseMs?: number | null;
}): Promise<MobileReviewGradeResult> {
  const database = input.database ?? db;
  const gradeResult = await applyReviewGrade({
    cardId: input.cardId,
    database,
    expectedUpdatedAt: input.expectedUpdatedAt,
    rating: input.rating,
    responseMs: input.responseMs ?? null
  });

  revalidateReviewSummaryCache(gradeResult.mediaId);

  if (gradeResult.consolidationQueued) {
    revalidateConsolidationSummaryCache(gradeResult.mediaId);
  }

  return {
    grade: {
      cardId: gradeResult.cardId,
      dueAt: gradeResult.dueAt,
      newState: gradeResult.newState,
      previousState: gradeResult.previousState,
      rating: input.rating
    },
    ok: true,
    session: await loadMobileReviewSession(database)
  };
}

function mapReviewPageDataToMobileSession(
  data: ReviewPageData,
  generatedAt: string
): MobileReviewSession {
  return {
    generatedAt,
    ok: true,
    queue: {
      dueCount: data.queue.dueCount,
      nextDueAt: data.queue.nextDueAt ?? null,
      queueCount: data.queue.queueCount,
      queueLabel: data.queue.queueLabel,
      upcomingCount: data.queue.upcomingCount
    },
    selectedCard: data.selectedCard ? mapReviewQueueCard(data.selectedCard) : null,
    source: "live"
  };
}

function mapReviewQueueCard(card: ReviewQueueCard): MobileReviewCard {
  return {
    back: card.back,
    cardId: card.id,
    effectiveState: card.effectiveState,
    entries: card.entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      label: entry.label,
      meaning: entry.meaning
    })),
    exampleIt: card.exampleIt,
    exampleJp: card.exampleJp,
    front: card.front,
    mediaSlug: card.mediaSlug,
    mediaTitle: card.mediaTitle,
    notes: card.notes,
    pronunciations: card.pronunciations.map((pronunciation) => ({
      kind: pronunciation.kind,
      label: pronunciation.label,
      meaning: pronunciation.meaning
    })),
    reviewStateUpdatedAt: card.reviewStateUpdatedAt ?? null
  };
}
