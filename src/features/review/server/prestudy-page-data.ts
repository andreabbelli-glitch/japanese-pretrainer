import {
  listPrestudyReviewCardsByMediaId,
  type MediaListItem
} from "@/db/queries";
import type { DatabaseClient } from "@/db";
import {
  mediaGlossaryHref,
  mediaHref,
  mediaStudyHref,
  mediaTextbookLessonHref
} from "@/features/navigation";
import type { ReviewCardSource } from "@/features/review/model/card-contract";
import type { ReviewSearchState } from "@/features/review/model/search-state";
import {
  buildEntryLookup,
  buildReviewMediaLookup,
  mapQueueCard
} from "@/features/review/server/card-presenters";
import { loadReviewEntrySummariesForCards } from "@/features/review/server/loader";
import type { ReviewProfiler } from "@/features/review/server/profiler";
import { measureWith } from "@/features/review/server/profiler";
import type { ReviewPageData } from "@/features/review/types";
import type { StudySettings } from "@/features/settings/types";

const REVIEW_ADVANCE_WINDOW_SIZE = 3;

type PrestudyLessonCard = ReviewCardSource & {
  lesson: NonNullable<ReviewCardSource["lesson"]> & {
    orderIndex: number | null;
    slug: string;
    title: string | null;
  };
  lessonId: string;
};

export async function loadPrestudyReviewPageData(input: {
  database: DatabaseClient;
  media: Pick<MediaListItem, "id" | "slug" | "title">;
  mediaRows: MediaListItem[];
  now: Date;
  profiler?: ReviewProfiler | null;
  searchState: ReviewSearchState;
  settings: Pick<
    StudySettings,
    "reviewAutoplayAudioOnReveal" | "reviewFrontFurigana"
  >;
}): Promise<ReviewPageData> {
  const prestudyCards = await measureWith(
    input.profiler,
    "listPrestudyReviewCardsByMediaId",
    () => listPrestudyReviewCardsByMediaId(input.database, input.media.id)
  );
  const { terms, grammar } = await measureWith(
    input.profiler,
    "loadReviewEntrySummariesForCards.prestudy",
    () =>
      loadReviewEntrySummariesForCards({
        cards: prestudyCards,
        database: input.database,
        profiler: input.profiler
      }),
    { cards: prestudyCards.length }
  );

  return buildPrestudyReviewPageData({
    cards: prestudyCards,
    entryLookup: buildEntryLookup(terms, grammar),
    media: {
      glossaryHref: mediaGlossaryHref(input.media.slug),
      href: mediaHref(input.media.slug),
      id: input.media.id,
      reviewHref: mediaStudyHref(input.media.slug, "review"),
      slug: input.media.slug,
      title: input.media.title
    },
    mediaById: buildReviewMediaLookup(input.mediaRows),
    now: input.now,
    reviewAutoplayAudioOnReveal: input.settings.reviewAutoplayAudioOnReveal,
    reviewFrontFurigana: input.settings.reviewFrontFurigana,
    searchState: input.searchState
  });
}

function buildPrestudyReviewPageData(input: {
  cards: ReviewCardSource[];
  entryLookup: Parameters<typeof mapQueueCard>[1];
  media: ReviewPageData["media"];
  mediaById: Parameters<typeof mapQueueCard>[3];
  now: Date;
  reviewAutoplayAudioOnReveal: boolean;
  reviewFrontFurigana: boolean;
  searchState: ReviewSearchState;
}) {
  const lessonCards = selectPrestudyLessonCards(input.cards);
  const nowIso = input.now.toISOString();
  const queueCards = lessonCards.map((card) => ({
    ...mapQueueCard(
      card,
      input.entryLookup,
      [card],
      input.mediaById,
      nowIso,
      undefined,
      undefined,
      undefined,
      {
        includePronunciations: true
      }
    ),
    bucketDetail: "Card della prossima lezione da studiare.",
    bucketLabel: "Prestudio",
    dueLabel: undefined,
    effectiveStateLabel: "Prestudio",
    rawReviewLabel: "Prestudio"
  }));
  const selectedCardId = input.searchState.selectedCardId;
  const selectedCard =
    queueCards.find((card) => card.id === selectedCardId) ??
    queueCards[0] ??
    null;
  const selectedIndex = selectedCard
    ? queueCards.findIndex((card) => card.id === selectedCard.id)
    : -1;
  const advanceCards =
    selectedIndex >= 0
      ? queueCards.slice(
          selectedIndex + 1,
          selectedIndex + 1 + REVIEW_ADVANCE_WINDOW_SIZE
        )
      : [];
  const prestudyLesson = lessonCards[0]?.lesson;
  const queueCount = queueCards.length;

  return {
    mode: "prestudy",
    scope: "media",
    media: input.media,
    settings: {
      reviewAutoplayAudioOnReveal: input.reviewAutoplayAudioOnReveal,
      reviewFrontFurigana: input.reviewFrontFurigana
    },
    queue: {
      advanceCards,
      cards: queueCards,
      dailyLimit: queueCount,
      dueCount: 0,
      effectiveDailyLimit: queueCount,
      introLabel: formatPrestudyQueueLabel(queueCount),
      manualCards: [],
      manualCount: 0,
      newAvailableCount: queueCount,
      newQueuedCount: queueCount,
      nextDueAt: null,
      queueCount,
      queueLabel: formatPrestudyQueueLabel(queueCount),
      suspendedCards: [],
      suspendedCount: 0,
      tomorrowCount: 0,
      upcomingCards: [],
      upcomingCount: 0
    },
    selectedCard,
    queueCardIds: queueCards.map((card) => card.id),
    selectedCardContext: {
      bucket: selectedCard?.bucket ?? null,
      gradePreviews: [],
      isQueueCard: selectedIndex >= 0,
      position: selectedIndex >= 0 ? selectedIndex + 1 : null,
      remainingCount: selectedIndex >= 0 ? queueCount - selectedIndex - 1 : 0,
      showAnswer: input.searchState.showAnswer
    },
    session: {
      answeredCount: input.searchState.answeredCount,
      extraNewAnchorCount: null,
      extraNewCount: 0,
      notice: undefined,
      prestudy: prestudyLesson
        ? {
            lessonHref: mediaTextbookLessonHref(
              input.media.slug,
              prestudyLesson.slug
            ),
            lessonId: lessonCards[0]!.lessonId,
            lessonSlug: prestudyLesson.slug,
            lessonTitle: prestudyLesson.title ?? "Prossima lezione",
            totalCards: queueCount
          }
        : null,
      segmentId: input.searchState.segmentId
    }
  } satisfies ReviewPageData;
}

function selectPrestudyLessonCards(cards: ReviewCardSource[]) {
  const candidates = cards
    .filter(isPrestudyLessonCard)
    .sort(comparePrestudyCards);
  const firstLessonId = candidates[0]?.lessonId;

  return firstLessonId
    ? candidates.filter((card) => card.lessonId === firstLessonId)
    : [];
}

function isPrestudyLessonCard(
  card: ReviewCardSource
): card is PrestudyLessonCard {
  return (
    card.status === "active" &&
    Boolean(card.lessonId) &&
    card.lesson?.status === "active" &&
    card.lesson.progress?.status !== "completed" &&
    typeof card.lesson.slug === "string" &&
    card.lesson.slug.length > 0
  );
}

function comparePrestudyCards(
  left: PrestudyLessonCard,
  right: PrestudyLessonCard
) {
  const leftLessonOrder = left.lesson.orderIndex ?? Number.MAX_SAFE_INTEGER;
  const rightLessonOrder = right.lesson.orderIndex ?? Number.MAX_SAFE_INTEGER;

  if (leftLessonOrder !== rightLessonOrder) {
    return leftLessonOrder - rightLessonOrder;
  }

  const leftCardOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
  const rightCardOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;

  if (leftCardOrder !== rightCardOrder) {
    return leftCardOrder - rightCardOrder;
  }

  return left.createdAt.localeCompare(right.createdAt);
}

function formatPrestudyQueueLabel(queueCount: number) {
  return queueCount === 1
    ? "1 card di prestudy per la prossima lezione."
    : `${queueCount} card di prestudy per la prossima lezione.`;
}
