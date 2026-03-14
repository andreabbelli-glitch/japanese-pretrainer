import { unstable_noStore as noStore } from "next/cache";

import {
  db,
  getMediaBySlug,
  listLessonsByMediaId,
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
  getEligibleReviewCardsByMediaId,
  getReviewQueueSnapshotForMedia
} from "@/lib/review";
import {
  buildSegments,
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
  const media = await Promise.all(rows.map((row) => buildMediaShellSnapshot(database, row)));
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

  return Promise.all(rows.map((row) => buildMediaShellSnapshot(database, row)));
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

async function buildMediaShellSnapshot(
  database: DatabaseClient,
  media: MediaListItem | NonNullable<Awaited<ReturnType<typeof getMediaBySlug>>>
): Promise<MediaShellSnapshot> {
  const [lessons, glossary, cards, reviewQueue] = await Promise.all([
    listLessonsByMediaId(database, media.id),
    loadGlossaryProgressSnapshot(database, media.id, media.slug),
    getEligibleReviewCardsByMediaId(media.id, database),
    getReviewQueueSnapshotForMedia(media.slug, database)
  ]);

  const lessonsCompleted = lessons.filter(
    (lesson) => lesson.progress?.status === "completed"
  ).length;
  const lessonsTotal = lessons.length;
  const activeReviewCards = cards.filter((card) =>
    isReviewCardActive(card.reviewState?.state ?? null)
  ).length;
  const cardsDue = reviewQueue?.dueCount ?? 0;
  const reviewSignals = buildReviewSignals({
    activeReviewCards,
    cardsDue,
    cardsTotal: cards.length,
    reviewQueue
  });
  const activeLesson = selectActiveLesson(lessons);
  const resumeLesson = selectResumeLesson(lessons);
  const nextLesson = selectNextLesson(lessons);

  return {
    id: media.id,
    slug: media.slug,
    title: media.title,
    description:
      media.description ??
      `Pacchetto ${formatMediaTypeLabel(media.mediaType).toLowerCase()} pronto per Textbook, Glossary e Review.`,
    mediaType: media.mediaType,
    mediaTypeLabel: formatMediaTypeLabel(media.mediaType),
    segmentKindLabel: formatSegmentKindLabel(media.segmentKind),
    statusLabel: formatStatusLabel(media.status),
    lessonsCompleted,
    lessonsTotal,
    textbookProgressPercent: calculatePercent(lessonsCompleted, lessonsTotal),
    entriesKnown: glossary.entriesCovered,
    entriesTotal: glossary.entriesTotal,
    glossaryProgressPercent: glossary.progressPercent,
    cardsDue,
    cardsTotal: cards.length,
    activeReviewCards,
    reviewStatValue: reviewSignals.value,
    reviewStatDetail: reviewSignals.detail,
    reviewQueueLabel: reviewSignals.queueLabel,
    activeLesson,
    resumeLesson,
    nextLesson,
    segments: buildSegments(lessons),
    previewEntries: glossary.previewEntries
  };
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
  reviewQueue
}: {
  cardsDue: number;
  activeReviewCards: number;
  cardsTotal: number;
  reviewQueue: Awaited<ReturnType<typeof getReviewQueueSnapshotForMedia>>;
}) {
  const nextCard = reviewQueue?.cards[0];

  if (reviewQueue && reviewQueue.queueCount > 0) {
    return {
      value:
        reviewQueue.dueCount > 0
          ? `${reviewQueue.queueCount} in coda`
          : reviewQueue.newQueuedCount > 0
            ? "Nuove pronte"
            : `${reviewQueue.queueCount} in coda`,
      detail: nextCard ? `Prossima card: ${nextCard.front}` : "Sessione pronta",
      queueLabel: reviewQueue.queueLabel
    };
  }

  if (cardsDue > 0) {
    return {
      value: `${cardsDue} dovute`,
      detail: nextCard ? `Prossima card: ${nextCard.front}` : "Richiedono attenzione adesso",
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

function isReviewCardActive(state: string | null) {
  return state !== null && state !== "known_manual" && state !== "suspended";
}
