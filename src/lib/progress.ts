import { unstable_noStore as noStore } from "next/cache";

import {
  db,
  getMediaBySlug,
  listLessonsByMediaId,
  type DatabaseClient
} from "@/db";
import {
  mediaGlossaryHref,
  mediaHref,
  reviewHref,
  mediaStudyHref,
  mediaTextbookLessonHref
} from "@/lib/site";
import { getStudySettings } from "@/lib/settings";
import {
  calculatePercent,
  compareIsoDates,
  formatMediaTypeLabel,
  formatSegmentKindLabel,
  formatStatusLabel
} from "@/lib/study-format";
import {
  buildSegments,
  loadGlossaryProgressSnapshot,
  mapLessonTarget,
  selectActiveLesson,
  selectResumeLesson,
  selectNextLesson
} from "@/lib/study-metrics";

import {
  loadGlobalReviewOverviewSnapshot,
  loadReviewOverviewSnapshots
} from "./review";

export type ProgressPageData = {
  globalReview: {
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
  glossary: Awaited<ReturnType<typeof loadGlossaryProgressSnapshot>>;
  media: {
    description: string;
    glossaryHref: ReturnType<typeof mediaGlossaryHref>;
    href: ReturnType<typeof mediaHref>;
    mediaTypeLabel: string;
    progressHref: ReturnType<typeof mediaStudyHref>;
    reviewHref: ReturnType<typeof mediaStudyHref>;
    segmentKindLabel: string;
    settingsHref: "/settings";
    slug: string;
    statusLabel: string;
    textbookHref: ReturnType<typeof mediaStudyHref>;
    title: string;
  };
  resume: {
    activeLesson: ReturnType<typeof selectActiveLesson>;
    activeLessonHref?: ReturnType<typeof mediaTextbookLessonHref>;
    lastOpenedLesson: ReturnType<typeof mapLessonTarget>;
    lastOpenedLessonHref?: ReturnType<typeof mediaTextbookLessonHref>;
    resumeLesson: ReturnType<typeof selectResumeLesson>;
    resumeLessonHref?: ReturnType<typeof mediaTextbookLessonHref>;
    nextLesson: ReturnType<typeof selectNextLesson>;
    nextLessonHref?: ReturnType<typeof mediaTextbookLessonHref>;
    recommendedArea: "review" | "textbook";
    recommendedBody: string;
    recommendedHref:
      | ReturnType<typeof reviewHref>
      | ReturnType<typeof mediaStudyHref>
      | ReturnType<typeof mediaTextbookLessonHref>;
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
    activeLesson: ReturnType<typeof selectActiveLesson>;
    resumeLesson: ReturnType<typeof selectResumeLesson>;
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

  const [lessons, glossary, reviewOverview, globalReviewOverview, settings] =
    await Promise.all([
      listLessonsByMediaId(database, media.id),
      loadGlossaryProgressSnapshot(database, media.id, media.slug),
      loadReviewOverviewSnapshots(database, [
        {
          id: media.id,
          slug: media.slug
        }
      ]).then((snapshots) => snapshots.get(media.id)),
      loadGlobalReviewOverviewSnapshot(database),
      getStudySettings(database)
    ]);
  const completedLessons = lessons.filter(
    (lesson) => lesson.progress?.status === "completed"
  ).length;
  const inProgressLessons = lessons.filter(
    (lesson) => lesson.progress?.status === "in_progress"
  ).length;
  const activeLesson = selectActiveLesson(lessons);
  const resumeLesson = selectResumeLesson(lessons);
  const nextLesson = selectNextLesson(lessons);
  const lastOpenedLesson = selectLastOpenedLesson(lessons);
  const review = mapReviewSnapshot(reviewOverview, settings.reviewDailyLimit);
  const globalReview = mapReviewSnapshot(
    globalReviewOverview,
    settings.reviewDailyLimit
  );
  const resume = buildResumeModel({
    globalReview,
    resumeLesson,
    mediaSlug: media.slug,
    nextLesson
  });

  return {
    globalReview,
    glossary,
    media: {
      description:
        media.description ??
        `${media.title} tiene insieme textbook, glossary e review in un percorso unico.`,
      glossaryHref: mediaGlossaryHref(media.slug),
      href: mediaHref(media.slug),
      mediaTypeLabel: formatMediaTypeLabel(media.mediaType),
      progressHref: mediaStudyHref(media.slug, "progress"),
      reviewHref: mediaStudyHref(media.slug, "review"),
      segmentKindLabel: formatSegmentKindLabel(media.segmentKind),
      settingsHref: "/settings",
      slug: media.slug,
      statusLabel: formatStatusLabel(media.status),
      textbookHref: mediaStudyHref(media.slug, "textbook"),
      title: media.title
    },
    resume: {
      ...resume,
      activeLesson,
      activeLessonHref: activeLesson
        ? mediaTextbookLessonHref(media.slug, activeLesson.slug)
        : undefined,
      lastOpenedLesson,
      lastOpenedLessonHref: lastOpenedLesson
        ? mediaTextbookLessonHref(media.slug, lastOpenedLesson.slug)
        : undefined,
      resumeLesson,
      resumeLessonHref: resumeLesson
        ? mediaTextbookLessonHref(media.slug, resumeLesson.slug)
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
      activeLesson,
      resumeLesson,
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
  globalReview: ProgressPageData["globalReview"];
  resumeLesson: ReturnType<typeof selectResumeLesson>;
  mediaSlug: string;
  nextLesson: ReturnType<typeof selectNextLesson>;
}) {
  if (input.globalReview.queueCount > 0) {
    const headlineCount =
      input.globalReview.dueCount > 0
        ? input.globalReview.dueCount
        : input.globalReview.queueCount;

    return {
      recommendedArea: "review" as const,
      recommendedBody: input.globalReview.nextCardFront
        ? `La prossima card pronta nella review globale è ${input.globalReview.nextCardFront}.`
        : input.globalReview.queueLabel,
      recommendedHref: reviewHref(),
      recommendedLabel: "Apri review globale",
      recommendedTitle:
        headlineCount === 1
          ? "1 card richiede attenzione"
          : `${headlineCount} card richiedono attenzione`
    };
  }

  const lesson = input.resumeLesson ?? input.nextLesson;

  if (lesson) {
    return {
      recommendedArea: "textbook" as const,
      recommendedBody:
        lesson.summary ??
        lesson.excerpt ??
        "Apri il prossimo passo naturale del percorso lesson.",
      recommendedHref: mediaTextbookLessonHref(input.mediaSlug, lesson.slug),
      recommendedLabel: "Continua il percorso",
      recommendedTitle: lesson.title
    };
  }

  return {
    recommendedArea: "textbook" as const,
    recommendedBody:
      "Il Textbook è pronto: puoi iniziare dal primo blocco disponibile.",
    recommendedHref: mediaStudyHref(input.mediaSlug, "textbook"),
    recommendedLabel: "Apri Textbook",
    recommendedTitle: "Percorso pronto"
  };
}

function mapReviewSnapshot(
  reviewOverview:
    | Awaited<ReturnType<typeof loadGlobalReviewOverviewSnapshot>>
    | ProgressPageData["review"]
    | undefined,
  dailyLimit: number
): ProgressPageData["review"] {
  return {
    activeCards: reviewOverview?.activeCards ?? 0,
    dailyLimit: reviewOverview?.dailyLimit ?? dailyLimit,
    dueCount: reviewOverview?.dueCount ?? 0,
    newAvailableCount: reviewOverview?.newAvailableCount ?? 0,
    newQueuedCount: reviewOverview?.newQueuedCount ?? 0,
    nextCardFront: reviewOverview?.nextCardFront,
    queueCount: reviewOverview?.queueCount ?? 0,
    queueLabel:
      reviewOverview?.queueLabel ??
      "La coda review si popolerà quando importerai le prime card.",
    queuePercent: calculatePercent(
      reviewOverview?.queueCount ?? 0,
      reviewOverview?.totalCards ?? 0
    ),
    suspendedCount: reviewOverview?.suspendedCount ?? 0,
    totalCards: reviewOverview?.totalCards ?? 0,
    upcomingCount: reviewOverview?.upcomingCount ?? 0
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
