import {
  countReviewSubjectsIntroducedOnDayByMediaIds,
  db,
  listGlossaryPreviewEntries,
  listGlossaryProgressSummaries,
  listLessonsByMediaId,
  listLessonsByMediaIds,
  type DatabaseClient,
  type MediaListItem
} from "@/db";
import { pickBestBy } from "@/lib/collections";
import {
  buildGlossarySummaryTags,
  buildReviewSummaryTags,
  getMediaBySlugCached,
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
import { mediaGlossaryEntryHref } from "@/lib/site";
import { loadReviewLaunchCandidatesCached } from "@/lib/review";
import { getReviewDailyLimit } from "@/lib/settings";
import {
  buildLessonMetrics,
  buildEmptyGlossaryProgressSnapshot,
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

const STUDY_STATE_LABELS: Record<string, string> = {
  known: "Già nota",
  learning: "In studio",
  review: "In review",
  new: "Nuova",
  available: "Disponibile"
};

export async function getMediaLibraryData(database: DatabaseClient = db) {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["app-shell", "media-library"],
    loader: async () => {
      const rows = await listMediaCached(database);

      return loadMediaShellSnapshots(database, rows, {
        includePreviewEntries: false
      });
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
      const media = await getMediaBySlugCached(database, mediaSlug);

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
  media: MediaListItem[],
  options: {
    includePreviewEntries?: boolean;
  } = {}
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
    loadGlossaryProgressSummarySnapshotsCached(
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

  const snapshots = media.map((item) => {
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

  if (options.includePreviewEntries === false) {
    return snapshots;
  }

  const focusMedia = pickFocusMedia(snapshots);

  if (!focusMedia) {
    return snapshots;
  }

  const focusPreviewEntries = await loadGlossaryPreviewEntriesCached(
    database,
    [
      {
        id: focusMedia.id,
        slug: focusMedia.slug
      }
    ]
  ).then((entriesByMedia) => entriesByMedia.get(focusMedia.id) ?? []);

  return snapshots.map((snapshot) =>
    snapshot.id === focusMedia.id
      ? {
          ...snapshot,
          glossary: {
            ...snapshot.glossary,
            previewEntries: focusPreviewEntries
          },
          previewEntries: focusPreviewEntries
        }
      : snapshot
  );
}

async function loadGlossaryProgressSummarySnapshotsCached(
  database: DatabaseClient,
  media: Array<{
    id: string;
    slug: string;
  }>
) {
  if (media.length === 0) {
    return new Map<string, GlossaryProgressSnapshot>();
  }

  const orderedMedia = [...media].sort((left, right) =>
    left.id.localeCompare(right.id, "it")
  );
  const snapshotRows = await runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "app-shell",
      "glossary-progress-summary",
      ...orderedMedia.map((item) => `media:${item.id}:${item.slug}`)
    ],
    loader: async () => {
      const summaries = await listGlossaryProgressSummaries(
        database,
        media.map((item) => item.id)
      );

      return summaries.map((summary) => ({
        mediaId: summary.mediaId,
        snapshot: {
          breakdown: {
            available: summary.available,
            known: summary.known,
            learning: summary.learning,
            new: summary.new,
            review: summary.review
          },
          entriesCovered: summary.entriesCovered,
          entriesTotal: summary.entriesTotal,
          previewEntries: [],
          progressPercent: calculatePercent(
            summary.entriesCovered,
            summary.entriesTotal
          )
        }
      }));
    },
    tags: buildGlossarySummaryTags(media.map((item) => item.id))
  });

  return new Map(snapshotRows.map((row) => [row.mediaId, row.snapshot] as const));
}

async function loadGlossaryPreviewEntriesCached(
  database: DatabaseClient,
  media: Array<{
    id: string;
    slug: string;
  }>
) {
  if (media.length === 0) {
    return new Map<string, StudyEntryPreview[]>();
  }

  const orderedMedia = [...media].sort((left, right) =>
    left.id.localeCompare(right.id, "it")
  );
  const previewRows = await runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "app-shell",
      "glossary-progress-preview",
      ...orderedMedia.map((item) => `media:${item.id}:${item.slug}`)
    ],
    loader: async () => {
      const previews = await listGlossaryPreviewEntries(
        database,
        media.map((item) => item.id),
        6
      );
      const previewsByMedia = new Map<string, StudyEntryPreview[]>();

      for (const preview of previews) {
        const existing = previewsByMedia.get(preview.mediaId) ?? [];

        existing.push({
          href: mediaGlossaryEntryHref(
            preview.mediaSlug,
            preview.kind,
            preview.sourceId
          ),
          id: preview.sourceId,
          kind: preview.kind,
          label: preview.label,
          meaning: preview.meaningIt,
          reading: preview.reading ?? undefined,
          segmentTitle: preview.segmentTitle ?? undefined,
          statusLabel: STUDY_STATE_LABELS[preview.state] ?? "Disponibile"
        });

        previewsByMedia.set(preview.mediaId, existing);
      }

      return media.map((item) => ({
        mediaId: item.id,
        previews: previewsByMedia.get(item.id) ?? []
      }));
    },
    tags: buildGlossarySummaryTags(media.map((item) => item.id))
  });

  return new Map(previewRows.map((row) => [row.mediaId, row.previews] as const));
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
  media: MediaListItem | NonNullable<Awaited<ReturnType<typeof getMediaBySlugCached>>>
): Promise<MediaShellSnapshot> {
  const nowIso = new Date().toISOString();
  const [
    lessons,
    glossarySnapshots,
    previewEntriesByMedia,
    reviewCandidates,
    dailyLimit,
    newIntroducedByMedia
  ] = await Promise.all([
    listLessonsByMediaId(database, media.id),
    loadGlossaryProgressSummarySnapshotsCached(database, [
      {
        id: media.id,
        slug: media.slug
      }
    ]),
    loadGlossaryPreviewEntriesCached(database, [
      {
        id: media.id,
        slug: media.slug
      }
    ]),
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
  const glossary =
    glossarySnapshots.get(media.id) ?? buildEmptyGlossaryProgressSnapshot();
  const previewEntries = previewEntriesByMedia.get(media.id) ?? [];

  return mapMediaShellSnapshotFromCounts({
    glossary: {
      ...glossary,
      previewEntries
    },
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

function pickFocusMedia(media: MediaShellSnapshot[]) {
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

function mapMediaShellSnapshotFromCounts(input: {
  glossary: GlossaryProgressSnapshot;
  lessons: Awaited<ReturnType<typeof listLessonsByMediaId>>;
  media:
    | MediaListItem
    | NonNullable<Awaited<ReturnType<typeof getMediaBySlugCached>>>;
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
