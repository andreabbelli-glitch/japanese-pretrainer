import type { Route } from "next";
import { unstable_noStore as noStore } from "next/cache";

import {
  db,
  getMediaBySlug,
  listCardsByMediaId,
  listDueCardsByMediaId,
  listGrammarEntriesByMediaId,
  listLessonsByMediaId,
  listMedia,
  listTermEntriesByMediaId,
  type DatabaseClient,
  type DueCardItem,
  type GrammarGlossaryEntry,
  type LessonListItem,
  type MediaListItem,
  type TermGlossaryEntry
} from "@/db";
import {
  calculatePercent,
  compareIsoDates,
  formatEntryStatusLabel,
  formatLessonProgressStatusLabel,
  formatMediaTypeLabel,
  formatSegmentKindLabel,
  formatStatusLabel
} from "@/lib/study-format";
import { mediaGlossaryEntryHref } from "@/lib/site";
import { getReviewQueueSnapshotForMedia } from "@/lib/review";

export type StudyEntryPreview = {
  id: string;
  kind: "term" | "grammar";
  label: string;
  reading?: string;
  meaning: string;
  statusLabel: string;
  segmentTitle?: string;
  href: Route;
};

export type SegmentStudyPreview = {
  id: string;
  title: string;
  note?: string | null;
  lessonCount: number;
  completedLessons: number;
  currentLessonTitle?: string;
};

export type LessonResumeTarget = {
  slug: string;
  title: string;
  summary?: string | null;
  excerpt?: string | null;
  statusLabel: string;
  segmentTitle?: string;
};

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
  currentLesson: LessonResumeTarget | null;
  nextLesson: LessonResumeTarget | null;
  segments: SegmentStudyPreview[];
  previewEntries: StudyEntryPreview[];
};

export type DashboardData = {
  focusMedia: MediaShellSnapshot | null;
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

  return {
    focusMedia,
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
  const [lessons, terms, grammar, cards, dueCards, reviewQueue] = await Promise.all([
    listLessonsByMediaId(database, media.id),
    listTermEntriesByMediaId(database, media.id),
    listGrammarEntriesByMediaId(database, media.id),
    listCardsByMediaId(database, media.id),
    listDueCardsByMediaId(database, media.id),
    getReviewQueueSnapshotForMedia(media.slug, database)
  ]);

  const lessonsCompleted = lessons.filter(
    (lesson) => lesson.progress?.status === "completed"
  ).length;
  const lessonsTotal = lessons.length;
  const entriesTotal = terms.length + grammar.length;
  const entriesKnown = countTrackedEntries([...terms, ...grammar]);
  const activeReviewCards = cards.filter((card) =>
    isReviewCardActive(card.reviewState?.state ?? null)
  ).length;
  const cardsDue = dueCards.length;
  const reviewSignals = buildReviewSignals({
    activeReviewCards,
    cardsDue,
    cardsTotal: cards.length,
    dueCards,
    reviewQueue
  });
  const currentLesson = selectCurrentLesson(lessons);
  const nextLesson = selectNextLesson(lessons);

  return {
    id: media.id,
    slug: media.slug,
    title: media.title,
    description:
      media.description ??
      `Pacchetto ${formatMediaTypeLabel(media.mediaType).toLowerCase()} pronto per textbook, glossary e review.`,
    mediaType: media.mediaType,
    mediaTypeLabel: formatMediaTypeLabel(media.mediaType),
    segmentKindLabel: formatSegmentKindLabel(media.segmentKind),
    statusLabel: formatStatusLabel(media.status),
    lessonsCompleted,
    lessonsTotal,
    textbookProgressPercent: calculatePercent(lessonsCompleted, lessonsTotal),
    entriesKnown,
    entriesTotal,
    glossaryProgressPercent: calculatePercent(entriesKnown, entriesTotal),
    cardsDue,
    cardsTotal: cards.length,
    activeReviewCards,
    reviewStatValue: reviewSignals.value,
    reviewStatDetail: reviewSignals.detail,
    reviewQueueLabel: reviewSignals.queueLabel,
    currentLesson,
    nextLesson,
    segments: buildSegments(lessons),
    previewEntries: buildPreviewEntries(terms, grammar, media.slug)
  };
}

function selectCurrentLesson(lessons: LessonListItem[]): LessonResumeTarget | null {
  const inProgress = [...lessons]
    .filter((lesson) => lesson.progress?.status === "in_progress")
    .sort((left, right) =>
      compareIsoDates(
        right.progress?.lastOpenedAt ?? null,
        left.progress?.lastOpenedAt ?? null
      )
    );

  if (inProgress[0]) {
    return mapLessonTarget(inProgress[0]);
  }

  return selectNextLesson(lessons);
}

function selectNextLesson(lessons: LessonListItem[]): LessonResumeTarget | null {
  const notCompleted = lessons.find(
    (lesson) => lesson.progress?.status !== "completed"
  );

  return mapLessonTarget(notCompleted ?? lessons.at(0) ?? null);
}

function mapLessonTarget(lesson: LessonListItem | null): LessonResumeTarget | null {
  if (!lesson) {
    return null;
  }

  return {
    slug: lesson.slug,
    title: lesson.title,
    summary: lesson.summary,
    excerpt: lesson.content?.excerpt,
    statusLabel: formatLessonProgressStatusLabel(lesson.progress?.status ?? null),
    segmentTitle: lesson.segment?.title
  };
}

function buildSegments(lessons: LessonListItem[]): SegmentStudyPreview[] {
  const groups = new Map<string, SegmentStudyPreview>();

  for (const lesson of lessons) {
    const key = lesson.segment?.id ?? "__ungrouped__";
    const currentLessonTitle =
      lesson.progress?.status === "in_progress" ? lesson.title : undefined;
    const existing = groups.get(key);

    if (existing) {
      existing.lessonCount += 1;
      existing.completedLessons += lesson.progress?.status === "completed" ? 1 : 0;

      if (!existing.currentLessonTitle && currentLessonTitle) {
        existing.currentLessonTitle = currentLessonTitle;
      }

      continue;
    }

    groups.set(key, {
      id: key,
      title: lesson.segment?.title ?? "Percorso principale",
      note: lesson.segment?.notes ?? null,
      lessonCount: 1,
      completedLessons: lesson.progress?.status === "completed" ? 1 : 0,
      currentLessonTitle
    });
  }

  return [...groups.values()];
}

function buildPreviewEntries(
  terms: TermGlossaryEntry[],
  grammar: GrammarGlossaryEntry[],
  mediaSlug: string
): StudyEntryPreview[] {
  return [
    ...terms.map((entry) => ({
      id: entry.id,
      kind: "term" as const,
      label: entry.lemma,
      reading: entry.reading,
      meaning: entry.meaningIt,
      statusLabel: formatEntryStatusLabel(entry.status?.status ?? null),
      segmentTitle: entry.segment?.title,
      href: mediaGlossaryEntryHref(mediaSlug, "term", entry.id)
    })),
    ...grammar.map((entry) => ({
      id: entry.id,
      kind: "grammar" as const,
      label: entry.pattern,
      reading: undefined,
      meaning: entry.meaningIt,
      statusLabel: formatEntryStatusLabel(entry.status?.status ?? null),
      segmentTitle: entry.segment?.title,
      href: mediaGlossaryEntryHref(mediaSlug, "grammar", entry.id)
    }))
  ].slice(0, 6);
}

function pickFocusMedia(media: MediaShellSnapshot[]) {
  return [...media].sort((left, right) => {
    return scoreMediaFocus(left) - scoreMediaFocus(right);
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
  if (item.currentLesson && item.currentLesson.statusLabel === "In corso") {
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

function buildReviewSignals({
  cardsDue,
  activeReviewCards,
  cardsTotal,
  dueCards,
  reviewQueue
}: {
  cardsDue: number;
  activeReviewCards: number;
  cardsTotal: number;
  dueCards: DueCardItem[];
  reviewQueue: Awaited<ReturnType<typeof getReviewQueueSnapshotForMedia>>;
}) {
  const nextCard = reviewQueue?.cards[0] ?? dueCards[0];

  if (reviewQueue && reviewQueue.queueCount > 0) {
    return {
      value:
        reviewQueue.dueCount > 0
          ? `${reviewQueue.queueCount} in coda`
          : reviewQueue.newQueuedCount > 0
            ? "Nuove pronte"
            : `${reviewQueue.queueCount} in coda`,
      detail: nextCard ? `Prossima carta: ${nextCard.front}` : "Sessione pronta",
      queueLabel: reviewQueue.queueLabel
    };
  }

  if (cardsDue > 0) {
    return {
      value: `${cardsDue} dovute`,
      detail: nextCard ? `Prossima carta: ${nextCard.front}` : "Richiedono attenzione adesso",
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
      detail: "Le card presenti non richiedono review attiva",
      queueLabel: "Le card presenti non richiedono review attiva in questo momento."
    };
  }

  return {
    value: "Vuota",
    detail: "Nessuna card review disponibile",
    queueLabel: "La coda review si popolerà quando importerai le prime card."
  };
}

function countTrackedEntries(
  entries: Array<{ status: { status: string } | null }>
) {
  return entries.filter((entry) => {
    const status = entry.status?.status;

    return status !== null && status !== undefined && status !== "unknown" && status !== "ignored";
  }).length;
}

function isReviewCardActive(state: string | null) {
  return state !== null && state !== "known_manual" && state !== "suspended";
}
