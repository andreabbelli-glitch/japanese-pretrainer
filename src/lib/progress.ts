import { unstable_noStore as noStore } from "next/cache";

import {
  db,
  getMediaBySlug,
  listLessonsByMediaId,
  listReviewCardsByMediaId,
  type DatabaseClient
} from "@/db";
import {
  mediaHref,
  mediaStudyHref,
  mediaTextbookLessonHref
} from "@/lib/site";
import { getStudySettings } from "@/lib/settings";
import {
  calculatePercent,
  compareIsoDates,
  formatMediaTypeLabel,
  formatSegmentKindLabel
} from "@/lib/study-format";
import {
  buildSegments,
  loadGlossaryProgressSnapshot,
  mapLessonTarget,
  selectCurrentLesson,
  selectNextLesson
} from "@/lib/study-metrics";

import { getReviewQueueSnapshotForMedia } from "./review";

export type ProgressPageData = {
  glossary: Awaited<ReturnType<typeof loadGlossaryProgressSnapshot>>;
  media: {
    description: string;
    glossaryHref: ReturnType<typeof mediaStudyHref>;
    href: ReturnType<typeof mediaHref>;
    mediaTypeLabel: string;
    progressHref: ReturnType<typeof mediaStudyHref>;
    reviewHref: ReturnType<typeof mediaStudyHref>;
    segmentKindLabel: string;
    settingsHref: "/settings";
    slug: string;
    textbookHref: ReturnType<typeof mediaStudyHref>;
    title: string;
  };
  resume: {
    currentLesson: ReturnType<typeof selectCurrentLesson>;
    currentLessonHref?: ReturnType<typeof mediaTextbookLessonHref>;
    lastOpenedLesson: ReturnType<typeof mapLessonTarget>;
    lastOpenedLessonHref?: ReturnType<typeof mediaTextbookLessonHref>;
    nextLesson: ReturnType<typeof selectNextLesson>;
    nextLessonHref?: ReturnType<typeof mediaTextbookLessonHref>;
    recommendedArea: "review" | "textbook";
    recommendedBody: string;
    recommendedHref: ReturnType<typeof mediaStudyHref> | ReturnType<typeof mediaTextbookLessonHref>;
    recommendedLabel: string;
    recommendedTitle: string;
  };
  review: {
    activeCards: number;
    dailyLimit: number;
    dueCount: number;
    newAvailableCount: number;
    newQueuedCount: number;
    nextCardFront?: string;
    queueCount: number;
    queueLabel: string;
    queuePercent: number | null;
    suspendedCount: number;
    totalCards: number;
    upcomingCount: number;
  };
  settings: Awaited<ReturnType<typeof getStudySettings>>;
  textbook: {
    completedLessons: number;
    currentLesson: ReturnType<typeof selectCurrentLesson>;
    inProgressLessons: number;
    lastOpenedLesson: ReturnType<typeof mapLessonTarget>;
    nextLesson: ReturnType<typeof selectNextLesson>;
    progressPercent: number | null;
    segments: ReturnType<typeof buildSegments>;
    totalLessons: number;
  };
};

export async function getMediaProgressPageData(
  mediaSlug: string,
  database: DatabaseClient = db
): Promise<ProgressPageData | null> {
  markDataAsLive();

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const [lessons, glossary, reviewQueue, reviewCards, settings] = await Promise.all([
    listLessonsByMediaId(database, media.id),
    loadGlossaryProgressSnapshot(database, media.id, media.slug),
    getReviewQueueSnapshotForMedia(media.slug, database),
    listReviewCardsByMediaId(database, media.id),
    getStudySettings(database)
  ]);
  const completedLessons = lessons.filter(
    (lesson) => lesson.progress?.status === "completed"
  ).length;
  const inProgressLessons = lessons.filter(
    (lesson) => lesson.progress?.status === "in_progress"
  ).length;
  const currentLesson = selectCurrentLesson(lessons);
  const nextLesson = selectNextLesson(lessons);
  const lastOpenedLesson = selectLastOpenedLesson(lessons);
  const review = {
    activeCards: reviewCards.filter((card) =>
      card.reviewState?.state !== null &&
      card.reviewState?.state !== "known_manual" &&
      card.reviewState?.state !== "suspended"
    ).length,
    dailyLimit: reviewQueue?.dailyLimit ?? settings.reviewDailyLimit,
    dueCount: reviewQueue?.dueCount ?? 0,
    newAvailableCount: reviewQueue?.newAvailableCount ?? 0,
    newQueuedCount: reviewQueue?.newQueuedCount ?? 0,
    nextCardFront: reviewQueue?.cards[0]?.front,
    queueCount: reviewQueue?.queueCount ?? 0,
    queueLabel:
      reviewQueue?.queueLabel ??
      "La coda review si popolerà quando importerai le prime card.",
    queuePercent: calculatePercent(
      reviewQueue?.queueCount ?? 0,
      reviewCards.length
    ),
    suspendedCount: reviewQueue?.suspendedCount ?? 0,
    totalCards: reviewCards.length,
    upcomingCount: reviewQueue?.upcomingCount ?? 0
  };
  const resume = buildResumeModel({
    currentLesson,
    mediaSlug: media.slug,
    nextLesson,
    review
  });

  return {
    glossary,
    media: {
      description:
        media.description ??
        `${media.title} tiene insieme textbook, glossary e review in un percorso unico.`,
      glossaryHref: mediaStudyHref(media.slug, "glossary"),
      href: mediaHref(media.slug),
      mediaTypeLabel: formatMediaTypeLabel(media.mediaType),
      progressHref: mediaStudyHref(media.slug, "progress"),
      reviewHref: mediaStudyHref(media.slug, "review"),
      segmentKindLabel: formatSegmentKindLabel(media.segmentKind),
      settingsHref: "/settings",
      slug: media.slug,
      textbookHref: mediaStudyHref(media.slug, "textbook"),
      title: media.title
    },
    resume: {
      ...resume,
      currentLesson,
      currentLessonHref: currentLesson
        ? mediaTextbookLessonHref(media.slug, currentLesson.slug)
        : undefined,
      lastOpenedLesson,
      lastOpenedLessonHref: lastOpenedLesson
        ? mediaTextbookLessonHref(media.slug, lastOpenedLesson.slug)
        : undefined,
      nextLesson,
      nextLessonHref: nextLesson
        ? mediaTextbookLessonHref(media.slug, nextLesson.slug)
        : undefined
    },
    review,
    settings,
    textbook: {
      completedLessons,
      currentLesson,
      inProgressLessons,
      lastOpenedLesson,
      nextLesson,
      progressPercent: calculatePercent(completedLessons, lessons.length),
      segments: buildSegments(lessons),
      totalLessons: lessons.length
    }
  };
}

function buildResumeModel(input: {
  currentLesson: ReturnType<typeof selectCurrentLesson>;
  mediaSlug: string;
  nextLesson: ReturnType<typeof selectNextLesson>;
  review: ProgressPageData["review"];
}) {
  if (input.review.queueCount > 0 && input.review.dueCount > 0) {
    return {
      recommendedArea: "review" as const,
      recommendedBody:
        input.review.nextCardFront
          ? `La prossima card pronta è ${input.review.nextCardFront}.`
          : input.review.queueLabel,
      recommendedHref: mediaStudyHref(input.mediaSlug, "review"),
      recommendedLabel: "Avvia review",
      recommendedTitle:
        input.review.dueCount === 1
          ? "1 card richiede attenzione"
          : `${input.review.dueCount} card richiedono attenzione`
    };
  }

  const lesson = input.currentLesson ?? input.nextLesson;

  if (lesson) {
    return {
      recommendedArea: "textbook" as const,
      recommendedBody:
        lesson.summary ??
        lesson.excerpt ??
        "Riprendi dal punto più naturale del percorso lesson.",
      recommendedHref: mediaTextbookLessonHref(input.mediaSlug, lesson.slug),
      recommendedLabel: "Riprendi lesson",
      recommendedTitle: lesson.title
    };
  }

  return {
    recommendedArea: "textbook" as const,
    recommendedBody: "Il Textbook è pronto: puoi iniziare dal primo blocco disponibile.",
    recommendedHref: mediaStudyHref(input.mediaSlug, "textbook"),
    recommendedLabel: "Apri Textbook",
    recommendedTitle: "Percorso pronto"
  };
}

function selectLastOpenedLesson(
  lessons: Awaited<ReturnType<typeof listLessonsByMediaId>>
) {
  return mapLessonTarget(
    [...lessons]
      .filter((lesson) => lesson.progress?.lastOpenedAt)
      .sort((left, right) =>
        compareIsoDates(
          right.progress?.lastOpenedAt ?? null,
          left.progress?.lastOpenedAt ?? null
        )
      )[0] ?? null
  );
}

function markDataAsLive() {
  try {
    noStore();
  } catch {
    // Rendering hint only.
  }
}
