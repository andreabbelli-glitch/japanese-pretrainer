import type { MediaListItem, listLessonsByMediaId } from "@/db";
import {
  calculatePercent,
  formatMediaTypeLabel,
  formatSegmentKindLabel,
  formatStatusLabel
} from "@/lib/study-format";
import {
  buildLessonMetrics,
  type GlossaryProgressSnapshot,
  type LessonResumeTarget,
  type SegmentStudyPreview,
  type StudyEntryPreview
} from "@/lib/study-metrics";
import { pickBestBy } from "@/lib/collections";

type MediaShellMedia = Pick<
  MediaListItem,
  | "description"
  | "id"
  | "mediaType"
  | "segmentKind"
  | "slug"
  | "status"
  | "title"
>;

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
  inProgressLessons: number;
  activeLesson: LessonResumeTarget | null;
  lastOpenedLesson: LessonResumeTarget | null;
  resumeLesson: LessonResumeTarget | null;
  nextLesson: LessonResumeTarget | null;
  segments: SegmentStudyPreview[];
  previewEntries: StudyEntryPreview[];
  glossary: GlossaryProgressSnapshot;
};

function buildReviewShellSignals(input: {
  dueCount: number;
  activeReviewCards: number;
  cardsTotal: number;
  newQueuedCount: number;
}) {
  const { dueCount, activeReviewCards, cardsTotal, newQueuedCount } = input;
  const queueCount = dueCount + newQueuedCount;

  if (queueCount > 0) {
    return {
      value:
        dueCount > 0
          ? `${dueCount} da ripassare`
          : newQueuedCount > 0
            ? "Nuove pronte"
            : `${queueCount} in coda`,
      detail: "Sessione pronta",
      queueLabel:
        dueCount > 0
          ? dueCount === 1
            ? "1 card richiede attenzione adesso."
            : `${dueCount} card richiedono attenzione adesso.`
          : newQueuedCount > 0
            ? newQueuedCount === 1
              ? "1 card nuova è pronta per oggi."
              : `${newQueuedCount} card nuove sono pronte per oggi.`
            : `${queueCount} in coda`
    };
  }

  if (dueCount > 0) {
    return {
      value: `${dueCount} da ripassare`,
      detail: "Richiedono attenzione adesso",
      queueLabel:
        dueCount === 1
          ? "1 card richiede attenzione adesso."
          : `${dueCount} card richiedono attenzione adesso.`
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
      queueLabel:
        "Le card presenti non richiedono Review attiva in questo momento."
    };
  }

  return {
    value: "Vuota",
    detail: "Nessuna card di Review disponibile",
    queueLabel: "La coda di Review si popolerà quando importerai le prime card."
  };
}

export function pickFocusMedia(media: MediaShellSnapshot[]) {
  return pickBestBy(media, (left, right) => {
    return scoreMediaFocus(left) - scoreMediaFocus(right);
  });
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

export function mapMediaShellSnapshotFromCounts(input: {
  glossary: GlossaryProgressSnapshot;
  lessons: Awaited<ReturnType<typeof listLessonsByMediaId>>;
  media: MediaShellMedia;
  reviewCounts?: {
    activeReviewCards: number;
    cardsTotal: number;
    dueCount: number;
    newQueuedCount: number;
  };
}): MediaShellSnapshot {
  const {
    lessonsCompleted,
    lessonsTotal,
    activeLesson,
    lastOpenedLesson,
    resumeLesson,
    nextLesson,
    segments
  } = buildLessonMetrics(input.lessons);
  const inProgressLessons = input.lessons.filter(
    (lesson) => lesson.progress?.status === "in_progress"
  ).length;
  const reviewCounts = input.reviewCounts ?? {
    activeReviewCards: 0,
    cardsTotal: 0,
    dueCount: 0,
    newQueuedCount: 0
  };
  const reviewSignals = buildReviewShellSignals(reviewCounts);

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
    cardsDue: reviewCounts.dueCount,
    cardsTotal: reviewCounts.cardsTotal,
    activeReviewCards: reviewCounts.activeReviewCards,
    reviewStatValue: reviewSignals.value,
    reviewStatDetail: reviewSignals.detail,
    reviewQueueLabel: reviewSignals.queueLabel,
    inProgressLessons,
    activeLesson,
    lastOpenedLesson,
    resumeLesson,
    nextLesson,
    segments,
    previewEntries: input.glossary.previewEntries,
    glossary: input.glossary
  };
}
