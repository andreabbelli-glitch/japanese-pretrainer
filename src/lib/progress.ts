import { db, type DatabaseClient } from "@/db";
import { getMediaDetailData } from "@/lib/media-shell";
import {
  buildGlossarySummaryTags,
  buildReviewSummaryTags,
  canUseDataCache,
  getMediaBySlugCached,
  listMediaCached,
  MEDIA_LIST_TAG,
  runWithTaggedCache,
  SETTINGS_TAG
} from "@/lib/data-cache";
import {
  mediaGlossaryHref,
  mediaHref,
  reviewHref,
  mediaStudyHref,
  mediaTextbookLessonHref
} from "@/lib/site";
import { getStudySettings } from "@/lib/settings";
import { calculatePercent } from "@/lib/study-format";
import {
  type GlossaryProgressSnapshot,
  type LessonResumeTarget,
  type SegmentStudyPreview
} from "@/lib/study-metrics";

import {
  loadGlobalAndMediaReviewOverviewSnapshots
} from "./review";
import type { ReviewOverviewSnapshot } from "./review-types";
import { getLocalIsoDateKey } from "./local-date";

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
    tomorrowCount: number;
    totalCards: number;
    upcomingCount: number;
  };
  glossary: GlossaryProgressSnapshot;
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
    activeLesson: LessonResumeTarget | null;
    activeLessonHref?: ReturnType<typeof mediaTextbookLessonHref>;
    lastOpenedLesson: LessonResumeTarget | null;
    lastOpenedLessonHref?: ReturnType<typeof mediaTextbookLessonHref>;
    resumeLesson: LessonResumeTarget | null;
    resumeLessonHref?: ReturnType<typeof mediaTextbookLessonHref>;
    nextLesson: LessonResumeTarget | null;
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
    tomorrowCount: number;
    totalCards: number;
    upcomingCount: number;
  };
  settings: Awaited<ReturnType<typeof getStudySettings>>;
  textbook: {
    completedLessons: number;
    activeLesson: LessonResumeTarget | null;
    resumeLesson: LessonResumeTarget | null;
    inProgressLessons: number;
    lastOpenedLesson: LessonResumeTarget | null;
    nextLesson: LessonResumeTarget | null;
    progressPercent: number | null;
    segments: SegmentStudyPreview[];
    totalLessons: number;
  };
};

export async function getMediaProgressPageData(
  mediaSlug: string,
  database: DatabaseClient = db
): Promise<ProgressPageData | null> {
  const media = await getMediaBySlugCached(database, mediaSlug);

  if (!media) {
    return null;
  }

  const cacheDayKey = getLocalIsoDateKey(new Date());

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["progress", "media-page", media.id, `day:${cacheDayKey}`],
    loader: async () => {
      const settingsPromise = getStudySettings(database);
      const mediaRowsPromise = listMediaCached(database);
      const reviewSnapshotsPromise = Promise.all([
        settingsPromise,
        mediaRowsPromise
      ]).then(([settings, mediaRows]) =>
        loadGlobalAndMediaReviewOverviewSnapshots(database, [media.id], {
          resolvedDailyLimit: settings.reviewDailyLimit,
          resolvedMediaRows: mediaRows
        })
      );
      const [sharedMedia, reviewSnapshots, settings] = await Promise.all([
        getMediaDetailData(mediaSlug, database, {
          includeReviewCounts: false,
          resolvedMedia: media
        }),
        reviewSnapshotsPromise,
        settingsPromise
      ]);

      if (!sharedMedia) {
        return null;
      }

      return buildMediaProgressPageData(sharedMedia, reviewSnapshots, settings);
    },
    tags: [
      MEDIA_LIST_TAG,
      SETTINGS_TAG,
      ...buildGlossarySummaryTags([media.id]),
      ...buildReviewSummaryTags([media.id])
    ]
  });
}

function buildMediaProgressPageData(
  sharedMedia: NonNullable<Awaited<ReturnType<typeof getMediaDetailData>>>,
  reviewSnapshots: Awaited<
    ReturnType<typeof loadGlobalAndMediaReviewOverviewSnapshots>
  >,
  settings: Awaited<ReturnType<typeof getStudySettings>>
): ProgressPageData {
  const reviewOverview = reviewSnapshots.byMedia.get(sharedMedia.id);
  const globalReviewOverview = reviewSnapshots.global;
  const review = mapReviewSnapshot(reviewOverview, settings.reviewDailyLimit);
  const globalReview = mapReviewSnapshot(
    globalReviewOverview,
    settings.reviewDailyLimit
  );
  const resume = buildResumeModel({
    globalReview,
    resumeLesson: sharedMedia.resumeLesson,
    mediaSlug: sharedMedia.slug,
    nextLesson: sharedMedia.nextLesson
  });

  return {
    globalReview,
    glossary: sharedMedia.glossary,
    media: {
      description: sharedMedia.description,
      glossaryHref: mediaGlossaryHref(sharedMedia.slug),
      href: mediaHref(sharedMedia.slug),
      mediaTypeLabel: sharedMedia.mediaTypeLabel,
      progressHref: mediaStudyHref(sharedMedia.slug, "progress"),
      reviewHref: mediaStudyHref(sharedMedia.slug, "review"),
      segmentKindLabel: sharedMedia.segmentKindLabel,
      settingsHref: "/settings",
      slug: sharedMedia.slug,
      statusLabel: sharedMedia.statusLabel,
      textbookHref: mediaStudyHref(sharedMedia.slug, "textbook"),
      title: sharedMedia.title
    },
    resume: {
      ...resume,
      activeLesson: sharedMedia.activeLesson,
      activeLessonHref: sharedMedia.activeLesson
        ? mediaTextbookLessonHref(sharedMedia.slug, sharedMedia.activeLesson.slug)
        : undefined,
      lastOpenedLesson: sharedMedia.lastOpenedLesson,
      lastOpenedLessonHref: sharedMedia.lastOpenedLesson
        ? mediaTextbookLessonHref(
            sharedMedia.slug,
            sharedMedia.lastOpenedLesson.slug
          )
        : undefined,
      resumeLesson: sharedMedia.resumeLesson,
      resumeLessonHref: sharedMedia.resumeLesson
        ? mediaTextbookLessonHref(sharedMedia.slug, sharedMedia.resumeLesson.slug)
        : undefined,
      nextLesson: sharedMedia.nextLesson,
      nextLessonHref: sharedMedia.nextLesson
        ? mediaTextbookLessonHref(sharedMedia.slug, sharedMedia.nextLesson.slug)
        : undefined
    },
    review,
    settings,
    textbook: {
      completedLessons: sharedMedia.lessonsCompleted,
      activeLesson: sharedMedia.activeLesson,
      resumeLesson: sharedMedia.resumeLesson,
      inProgressLessons: sharedMedia.inProgressLessons,
      lastOpenedLesson: sharedMedia.lastOpenedLesson,
      nextLesson: sharedMedia.nextLesson,
      progressPercent: sharedMedia.textbookProgressPercent,
      segments: sharedMedia.segments,
      totalLessons: sharedMedia.lessonsTotal
    }
  };
}

function buildResumeModel(input: {
  globalReview: ProgressPageData["globalReview"];
  resumeLesson: LessonResumeTarget | null;
  mediaSlug: string;
  nextLesson: LessonResumeTarget | null;
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
    | ReviewOverviewSnapshot
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
    tomorrowCount: reviewOverview?.tomorrowCount ?? 0,
    totalCards: reviewOverview?.totalCards ?? 0,
    upcomingCount: reviewOverview?.upcomingCount ?? 0
  };
}
