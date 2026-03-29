import {
  countReviewSubjectsIntroducedOnDayByMediaIds,
  db,
  getMediaBySlug,
  listLessonsByMediaId,
  listLessonsByMediaIds,
  type DatabaseClient,
  type MediaListItem
} from "@/db";
import {
  buildGlossarySummaryTags,
  buildReviewSummaryTags,
  GLOSSARY_SUMMARY_TAG,
  listMediaCached,
  MEDIA_LIST_TAG,
  canUseDataCache,
  REVIEW_FIRST_CANDIDATE_TAG,
  REVIEW_SUMMARY_TAG,
  runWithTaggedCache,
  SETTINGS_TAG
} from "@/lib/data-cache";
import {
  calculatePercent,
  formatMediaTypeLabel,
  formatSegmentKindLabel,
  formatStatusLabel
} from "@/lib/study-format";
import { loadReviewLaunchCandidatesCached } from "@/lib/review";
import { getReviewDailyLimit } from "@/lib/settings";
import {
  buildLessonMetrics,
  buildEmptyGlossaryProgressSnapshot,
  loadGlossaryProgressSnapshots,
  loadGlossaryProgressSnapshot,
  type GlossaryProgressSnapshot,
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
  inProgressLessons: number;
  activeLesson: LessonResumeTarget | null;
  lastOpenedLesson: LessonResumeTarget | null;
  resumeLesson: LessonResumeTarget | null;
  nextLesson: LessonResumeTarget | null;
  segments: SegmentStudyPreview[];
  previewEntries: StudyEntryPreview[];
  glossary: GlossaryProgressSnapshot;
};

export async function getMediaLibraryData(database: DatabaseClient = db) {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["app-shell", "media-library"],
    loader: async () => {
      const rows = await listMediaCached(database);

      return loadMediaShellSnapshots(database, rows);
    },
    tags: [
      MEDIA_LIST_TAG,
      GLOSSARY_SUMMARY_TAG,
      REVIEW_SUMMARY_TAG,
      REVIEW_FIRST_CANDIDATE_TAG,
      SETTINGS_TAG
    ]
  });
}

export async function getMediaDetailData(
  mediaSlug: string,
  database: DatabaseClient = db
) {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["app-shell", "media-detail", mediaSlug],
    loader: async () => {
      const media = await getMediaBySlug(database, mediaSlug);

      if (!media) {
        return null;
      }

      return buildMediaShellSnapshot(database, media);
    },
    tags: [
      MEDIA_LIST_TAG,
      GLOSSARY_SUMMARY_TAG,
      REVIEW_SUMMARY_TAG,
      REVIEW_FIRST_CANDIDATE_TAG,
      SETTINGS_TAG
    ]
  });
}

export async function loadMediaShellSnapshots(
  database: DatabaseClient,
  media: MediaListItem[]
) {
  if (media.length === 0) {
    return [];
  }

  const nowIso = new Date().toISOString();
  const mediaIds = media.map((item) => item.id);
  const [
    lessons,
    glossarySnapshots,
    reviewCandidates,
    dailyLimit,
    newIntroducedByMedia
  ] = await Promise.all([
    listLessonsByMediaIds(database, mediaIds),
    loadGlossaryProgressSnapshotsCached(
      database,
      media.map((item) => ({
        id: item.id,
        slug: item.slug
      }))
    ),
    loadReviewLaunchCandidatesCached(database, nowIso),
    getReviewDailyLimit(database),
    loadReviewIntroducedOnDayCached(database, mediaIds)
  ]);
  const lessonsByMedia = groupLessonsByMedia(lessons);

  const candidatesByMedia = new Map(
    reviewCandidates.map((candidate) => [candidate.mediaId, candidate])
  );
  const newIntroducedMap = new Map(
    newIntroducedByMedia.map((entry) => [entry.mediaId, entry.count])
  );

  return media.map((item) => {
    const candidate = candidatesByMedia.get(item.id);
    const newIntroducedForMedia = newIntroducedMap.get(item.id) ?? 0;
    const newQueuedCount = Math.min(
      candidate?.newCount ?? 0,
      Math.max(dailyLimit - newIntroducedForMedia, 0)
    );

    return mapMediaShellSnapshotFromCounts({
      glossary:
        glossarySnapshots.get(item.id) ??
        buildEmptyGlossaryProgressSnapshot(),
      lessons: lessonsByMedia.get(item.id) ?? [],
      media: item,
      reviewCounts: {
        activeReviewCards: candidate?.activeReviewCards ?? 0,
        cardsTotal: candidate?.cardsTotal ?? 0,
        dueCount: candidate?.dueCount ?? 0,
        newQueuedCount
      }
    });
  });
}

async function loadGlossaryProgressSnapshotsCached(
  database: DatabaseClient,
  media: Array<{
    id: string;
    slug: string;
  }>
) {
  if (media.length === 0) {
    return new Map<
      string,
      Awaited<ReturnType<typeof loadGlossaryProgressSnapshot>>
    >();
  }

  const orderedMedia = [...media].sort((left, right) =>
    left.id.localeCompare(right.id, "it")
  );
  const snapshotRows = await runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "app-shell",
      "glossary-progress",
      ...orderedMedia.map((item) => `media:${item.id}:${item.slug}`)
    ],
    loader: async () => {
      const snapshots = await loadGlossaryProgressSnapshots(database, media);

      return media.map((item) => ({
        mediaId: item.id,
        snapshot: snapshots.get(item.id) ?? buildEmptyGlossaryProgressSnapshot()
      }));
    },
    tags: buildGlossarySummaryTags(media.map((item) => item.id))
  });

  return new Map(snapshotRows.map((row) => [row.mediaId, row.snapshot] as const));
}

async function loadReviewIntroducedOnDayCached(
  database: DatabaseClient,
  mediaIds: string[]
) {
  if (mediaIds.length === 0) {
    return [];
  }

  const orderedIds = [...mediaIds].sort();

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["app-shell", "review-introduced", ...orderedIds],
    loader: () =>
      countReviewSubjectsIntroducedOnDayByMediaIds(database, mediaIds),
    tags: buildReviewSummaryTags(mediaIds)
  });
}

async function buildMediaShellSnapshot(
  database: DatabaseClient,
  media: MediaListItem | NonNullable<Awaited<ReturnType<typeof getMediaBySlug>>>
): Promise<MediaShellSnapshot> {
  const nowIso = new Date().toISOString();
  const [lessons, glossary, reviewCandidates, dailyLimit, newIntroducedByMedia] =
    await Promise.all([
      listLessonsByMediaId(database, media.id),
      loadGlossaryProgressSnapshotsCached(database, [
        {
          id: media.id,
          slug: media.slug
        }
      ]).then(
        (snapshots) =>
          snapshots.get(media.id) ?? buildEmptyGlossaryProgressSnapshot()
      ),
      loadReviewLaunchCandidatesCached(database, nowIso),
      getReviewDailyLimit(database),
      loadReviewIntroducedOnDayCached(database, [media.id])
    ]);

  const candidate = reviewCandidates.find((c) => c.mediaId === media.id);
  const newIntroducedForMedia =
    newIntroducedByMedia.find((e) => e.mediaId === media.id)?.count ?? 0;
  const newQueuedCount = Math.min(
    candidate?.newCount ?? 0,
    Math.max(dailyLimit - newIntroducedForMedia, 0)
  );

  return mapMediaShellSnapshotFromCounts({
    glossary,
    lessons,
    media,
    reviewCounts: {
      activeReviewCards: candidate?.activeReviewCards ?? 0,
      cardsTotal: candidate?.cardsTotal ?? 0,
      dueCount: candidate?.dueCount ?? 0,
      newQueuedCount
    }
  });
}

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

function mapMediaShellSnapshotFromCounts(input: {
  glossary: Awaited<ReturnType<typeof loadGlossaryProgressSnapshot>>;
  lessons: Awaited<ReturnType<typeof listLessonsByMediaId>>;
  media:
    | MediaListItem
    | NonNullable<Awaited<ReturnType<typeof getMediaBySlug>>>;
  reviewCounts: {
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
  const reviewSignals = buildReviewShellSignals(input.reviewCounts);

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
    cardsDue: input.reviewCounts.dueCount,
    cardsTotal: input.reviewCounts.cardsTotal,
    activeReviewCards: input.reviewCounts.activeReviewCards,
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

function groupLessonsByMedia(
  lessons: Awaited<ReturnType<typeof listLessonsByMediaIds>>
) {
  const grouped = new Map<
    string,
    Awaited<ReturnType<typeof listLessonsByMediaId>>
  >();

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
