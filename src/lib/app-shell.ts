import { unstable_noStore as noStore } from "next/cache";

import {
  db,
  getMediaBySlug,
  listLessonsByMediaId,
  listLessonsByMediaIds,
  listMedia,
  type DatabaseClient,
  type MediaListItem
} from "@/db";
import {
  calculatePercent,
  formatMediaTypeLabel,
  formatSegmentKindLabel,
  formatStatusLabel
} from "@/lib/study-format";
import {
  buildReviewOverviewSnapshot,
  buildReviewEntryStatusLookup,
  loadReviewOverviewSnapshots
} from "@/lib/review";
import {
  buildSegments,
  buildGlossaryProgressSnapshot,
  loadGlossaryProgressSnapshots,
  loadGlossaryProgressSnapshot,
  selectActiveLesson,
  selectResumeLesson,
  selectNextLesson,
  type LessonResumeTarget,
  type SegmentStudyPreview,
  type StudyEntryPreview
} from "@/lib/study-metrics";

export type MediaShellSnapshot = {
  id: string;
  slug: string;
  title: string;
  description: string;
  mediaType: string;
  mediaTypeLabel: string;
  segmentKindLabel: string;
  statusLabel: string;
  lessonsCompleted: number;
  lessonsTotal: number;
  textbookProgressPercent: number | null;
  entriesKnown: number;
  entriesTotal: number;
  glossaryProgressPercent: number | null;
  cardsDue: number;
  cardsTotal: number;
  activeReviewCards: number;
  reviewStatValue: string;
  reviewStatDetail: string;
  reviewQueueLabel: string;
  activeLesson: LessonResumeTarget | null;
  resumeLesson: LessonResumeTarget | null;
  nextLesson: LessonResumeTarget | null;
  segments: SegmentStudyPreview[];
  previewEntries: StudyEntryPreview[];
};

export type DashboardData = {
  focusMedia: MediaShellSnapshot | null;
  reviewMedia: MediaShellSnapshot | null;
  media: MediaShellSnapshot[];
  totals: {
    cardsDue: number;
    lessonsCompleted: number;
    lessonsTotal: number;
    entriesKnown: number;
    entriesTotal: number;
    activeReviewCards: number;
  };
};

export async function getDashboardData(
  database: DatabaseClient = db
): Promise<DashboardData> {
  markDataAsLive();

  const rows = await listMedia(database);
  const media = await buildMediaShellSnapshots(database, rows);
  const focusMedia = pickFocusMedia(media);
  const reviewMedia = pickReviewMedia(media);

  return {
    focusMedia,
    reviewMedia,
    media,
    totals: {
      cardsDue: media.reduce((sum, item) => sum + item.cardsDue, 0),
      lessonsCompleted: media.reduce((sum, item) => sum + item.lessonsCompleted, 0),
      lessonsTotal: media.reduce((sum, item) => sum + item.lessonsTotal, 0),
      entriesKnown: media.reduce((sum, item) => sum + item.entriesKnown, 0),
      entriesTotal: media.reduce((sum, item) => sum + item.entriesTotal, 0),
      activeReviewCards: media.reduce((sum, item) => sum + item.activeReviewCards, 0)
    }
  };
}

export async function getMediaLibraryData(database: DatabaseClient = db) {
  markDataAsLive();

  const rows = await listMedia(database);

  return buildMediaShellSnapshots(database, rows);
}

export async function getMediaDetailData(
  mediaSlug: string,
  database: DatabaseClient = db
) {
  markDataAsLive();

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  return buildMediaShellSnapshot(database, media);
}

async function buildMediaShellSnapshots(
  database: DatabaseClient,
  media: MediaListItem[]
) {
  if (media.length === 0) {
    return [];
  }

  const [lessons, glossarySnapshots, reviewSnapshots] = await Promise.all([
    listLessonsByMediaIds(
      database,
      media.map((item) => item.id)
    ),
    loadGlossaryProgressSnapshots(
      database,
      media.map((item) => ({
        id: item.id,
        slug: item.slug
      }))
    ),
    loadReviewOverviewSnapshots(
      database,
      media.map((item) => ({
        id: item.id,
        slug: item.slug
      }))
    )
  ]);
  const lessonsByMedia = groupLessonsByMedia(lessons);

  return media.map((item) =>
    mapMediaShellSnapshot({
      glossary:
        glossarySnapshots.get(item.id) ??
        buildGlossaryProgressSnapshot({
          grammar: [],
          mediaSlug: item.slug,
          studySignals: [],
          terms: []
        }),
      lessons: lessonsByMedia.get(item.id) ?? [],
      media: item,
      review:
        reviewSnapshots.get(item.id) ??
        buildReviewOverviewSnapshot({
          cards: [],
          dailyLimit: 0,
          entryStatuses: buildReviewEntryStatusLookup({
            grammar: [],
            terms: []
          }),
          extraNewCount: 0,
          newIntroducedTodayCount: 0
        })
    })
  );
}

async function buildMediaShellSnapshot(
  database: DatabaseClient,
  media: MediaListItem | NonNullable<Awaited<ReturnType<typeof getMediaBySlug>>>
): Promise<MediaShellSnapshot> {
  const [lessons, glossary, review] = await Promise.all([
    listLessonsByMediaId(database, media.id),
    loadGlossaryProgressSnapshot(database, media.id, media.slug),
    loadReviewOverviewSnapshots(database, [
      {
        id: media.id,
        slug: media.slug
      }
    ]).then((snapshots) =>
      snapshots.get(media.id) ??
      buildReviewOverviewSnapshot({
        cards: [],
        dailyLimit: 0,
        entryStatuses: buildReviewEntryStatusLookup({
          grammar: [],
          terms: []
        }),
        extraNewCount: 0,
        newIntroducedTodayCount: 0
      })
    )
  ]);

  return mapMediaShellSnapshot({
    glossary,
    lessons,
    media,
    review
  });
}

function pickFocusMedia(media: MediaShellSnapshot[]) {
  return [...media].sort((left, right) => {
    return scoreMediaFocus(left) - scoreMediaFocus(right);
  })[0] ?? null;
}

function pickReviewMedia(media: MediaShellSnapshot[]) {
  return [...media].sort((left, right) => {
    const scoreDifference = scoreMediaReview(left) - scoreMediaReview(right);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    if (left.cardsDue !== right.cardsDue) {
      return right.cardsDue - left.cardsDue;
    }

    if (left.activeReviewCards !== right.activeReviewCards) {
      return right.activeReviewCards - left.activeReviewCards;
    }

    if (left.cardsTotal !== right.cardsTotal) {
      return right.cardsTotal - left.cardsTotal;
    }

    return left.title.localeCompare(right.title, "it");
  })[0] ?? null;
}

function markDataAsLive() {
  try {
    noStore();
  } catch {
    // `noStore` is a rendering hint; tests can execute these helpers outside a request.
  }
}

function scoreMediaFocus(item: MediaShellSnapshot) {
  if (item.activeLesson) {
    return 0;
  }

  if (item.cardsDue > 0) {
    return 1;
  }

  if ((item.textbookProgressPercent ?? 0) < 100) {
    return 2;
  }

  return 3;
}

function scoreMediaReview(item: MediaShellSnapshot) {
  if (item.cardsDue > 0) {
    return 0;
  }

  if (item.activeReviewCards > 0) {
    return 1;
  }

  if (item.cardsTotal > 0) {
    return 2;
  }

  return 3;
}

function buildReviewSignals({
  cardsDue,
  activeReviewCards,
  cardsTotal,
  review
}: {
  cardsDue: number;
  activeReviewCards: number;
  cardsTotal: number;
  review: ReturnType<typeof buildReviewOverviewSnapshot>;
}) {
  const nextCardFront = review.nextCardFront;

  if (review.queueCount > 0) {
    return {
      value:
        review.dueCount > 0
          ? `${review.queueCount} in coda`
          : review.newQueuedCount > 0
            ? "Nuove pronte"
            : `${review.queueCount} in coda`,
      detail: nextCardFront ? `Prossima card: ${nextCardFront}` : "Sessione pronta",
      queueLabel: review.queueLabel
    };
  }

  if (cardsDue > 0) {
    return {
      value: `${cardsDue} dovute`,
      detail: nextCardFront
        ? `Prossima card: ${nextCardFront}`
        : "Richiedono attenzione adesso",
      queueLabel:
        cardsDue === 1
          ? "1 card richiede attenzione adesso."
          : `${cardsDue} card richiedono attenzione adesso.`
    };
  }

  if (activeReviewCards > 0) {
    return {
      value: "In pari",
      detail:
        activeReviewCards === 1
          ? "1 card è già nella rotazione"
          : `${activeReviewCards} card sono già nella rotazione`,
      queueLabel:
        activeReviewCards === 1
          ? "1 card è già nella rotazione e oggi la coda è in pari."
          : `${activeReviewCards} card sono già nella rotazione e oggi la coda è in pari.`
    };
  }

  if (cardsTotal > 0) {
    return {
      value: "In pausa",
      detail: "Le card presenti non richiedono Review attiva",
      queueLabel: "Le card presenti non richiedono Review attiva in questo momento."
    };
  }

  return {
    value: "Vuota",
    detail: "Nessuna card di Review disponibile",
    queueLabel: "La coda di Review si popolerà quando importerai le prime card."
  };
}

function mapMediaShellSnapshot(input: {
  glossary: Awaited<ReturnType<typeof loadGlossaryProgressSnapshot>>;
  lessons: Awaited<ReturnType<typeof listLessonsByMediaId>>;
  media: MediaListItem | NonNullable<Awaited<ReturnType<typeof getMediaBySlug>>>;
  review: ReturnType<typeof buildReviewOverviewSnapshot>;
}): MediaShellSnapshot {
  const lessonsCompleted = input.lessons.filter(
    (lesson) => lesson.progress?.status === "completed"
  ).length;
  const lessonsTotal = input.lessons.length;
  const activeLesson = selectActiveLesson(input.lessons);
  const resumeLesson = selectResumeLesson(input.lessons);
  const nextLesson = selectNextLesson(input.lessons);
  const reviewSignals = buildReviewSignals({
    activeReviewCards: input.review.activeCards,
    cardsDue: input.review.dueCount,
    cardsTotal: input.review.totalCards,
    review: input.review
  });

  return {
    id: input.media.id,
    slug: input.media.slug,
    title: input.media.title,
    description:
      input.media.description ??
      `Pacchetto ${formatMediaTypeLabel(input.media.mediaType).toLowerCase()} pronto per Textbook, Glossary e Review.`,
    mediaType: input.media.mediaType,
    mediaTypeLabel: formatMediaTypeLabel(input.media.mediaType),
    segmentKindLabel: formatSegmentKindLabel(input.media.segmentKind),
    statusLabel: formatStatusLabel(input.media.status),
    lessonsCompleted,
    lessonsTotal,
    textbookProgressPercent: calculatePercent(lessonsCompleted, lessonsTotal),
    entriesKnown: input.glossary.entriesCovered,
    entriesTotal: input.glossary.entriesTotal,
    glossaryProgressPercent: input.glossary.progressPercent,
    cardsDue: input.review.dueCount,
    cardsTotal: input.review.totalCards,
    activeReviewCards: input.review.activeCards,
    reviewStatValue: reviewSignals.value,
    reviewStatDetail: reviewSignals.detail,
    reviewQueueLabel: reviewSignals.queueLabel,
    activeLesson,
    resumeLesson,
    nextLesson,
    segments: buildSegments(input.lessons),
    previewEntries: input.glossary.previewEntries
  };
}

function groupLessonsByMedia(
  lessons: Awaited<ReturnType<typeof listLessonsByMediaIds>>
) {
  const grouped = new Map<string, Awaited<ReturnType<typeof listLessonsByMediaId>>>();

  for (const lesson of lessons) {
    const existing = grouped.get(lesson.mediaId);

    if (existing) {
      existing.push(lesson);
      continue;
    }

    grouped.set(lesson.mediaId, [lesson]);
  }

  return grouped;
}
