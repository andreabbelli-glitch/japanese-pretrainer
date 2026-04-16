import {
  db,
  listGlossaryPreviewEntries,
  listGlossaryProgressSummaries,
  listLessonsByMediaId,
  listLessonsByMediaIds,
  type DatabaseClient,
  type MediaListItem
} from "@/db";
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
import { calculatePercent } from "@/lib/study-format";
import { mediaGlossaryEntryHref } from "@/lib/site";
import {
  loadReviewLaunchCandidateByMediaIdCached,
  loadReviewIntroducedTodayCountCached,
  loadReviewLaunchCandidatesCached
} from "@/lib/review-loader";
import { getReviewDailyLimit } from "@/lib/settings";
import {
  buildEmptyGlossaryProgressSnapshot,
  type GlossaryProgressSnapshot,
  type StudyEntryPreview
} from "@/lib/study-metrics";
import {
  mapMediaShellSnapshotFromCounts,
  pickFocusMedia,
  type MediaShellSnapshot
} from "@/lib/media-shell-snapshot";
import { getLocalIsoDateKey } from "@/lib/local-date";

const STUDY_STATE_LABELS: Record<string, string> = {
  known: "Già nota",
  learning: "In studio",
  review: "In review",
  new: "Nuova",
  available: "Disponibile"
};

function buildGlossaryReviewTags(mediaIds: string[] = []) {
  return [
    ...buildGlossarySummaryTags(mediaIds),
    ...buildReviewSummaryTags(mediaIds)
  ];
}

type ResolvedMedia = NonNullable<Awaited<ReturnType<typeof getMediaBySlugCached>>>;

export async function getMediaLibraryData(database: DatabaseClient = db) {
  const cacheDayKey = getLocalIsoDateKey(new Date());

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["app-shell", "media-library", `day:${cacheDayKey}`],
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
  database: DatabaseClient = db,
  options: {
    includeReviewCounts?: boolean;
    resolvedMedia?: ResolvedMedia | null;
  } = {}
) {
  const media =
    options.resolvedMedia ??
    (await getMediaBySlugCached(database, mediaSlug));

  if (!media) {
    return null;
  }

  const cacheDayKey = getLocalIsoDateKey(new Date());

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "app-shell",
      "media-detail",
      mediaSlug,
      options.includeReviewCounts === false ? "study-only" : "full",
      `day:${cacheDayKey}`
    ],
    loader: () =>
      buildMediaShellSnapshot(database, media, {
        includeReviewCounts: options.includeReviewCounts
      }),
    tags:
      options.includeReviewCounts === false
        ? [MEDIA_LIST_TAG, ...buildGlossaryReviewTags([media.id])]
        : [
            MEDIA_LIST_TAG,
            ...buildGlossaryReviewTags([media.id]),
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
    previewEntryLimit?: number;
    resolvedDailyLimit?: number;
    resolvedNewIntroducedTodayCount?: number;
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
    newIntroducedTodayCount
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
    options.resolvedDailyLimit ?? getReviewDailyLimit(database),
    options.resolvedNewIntroducedTodayCount ??
      loadReviewIntroducedTodayCountCached(database, new Date(nowIso))
  ]);
  const lessonsByMedia = groupLessonsByMedia(lessons);

  const candidatesByMedia = new Map(
    reviewCandidates.map((candidate) => [candidate.mediaId, candidate])
  );
  const remainingNewSlots = Math.max(dailyLimit - newIntroducedTodayCount, 0);

  const snapshots = media.map((item) => {
    const candidate = candidatesByMedia.get(item.id);
    const newQueuedCount = Math.min(
      candidate?.newCount ?? 0,
      remainingNewSlots
    );

    return mapMediaShellSnapshotFromCounts({
      glossary:
        glossarySnapshots.get(item.id) ?? buildEmptyGlossaryProgressSnapshot(),
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

  const focusPreviewEntries = await loadGlossaryPreviewEntriesCached(database, [
    {
      id: focusMedia.id,
      slug: focusMedia.slug
    }
  ], options.previewEntryLimit ?? 1).then(
    (entriesByMedia) => entriesByMedia.get(focusMedia.id) ?? []
  );

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
    tags: buildGlossaryReviewTags(media.map((item) => item.id))
  });

  return new Map(
    snapshotRows.map((row) => [row.mediaId, row.snapshot] as const)
  );
}

async function loadGlossaryPreviewEntriesCached(
  database: DatabaseClient,
  media: Array<{
    id: string;
    slug: string;
  }>,
  limitPerMedia = 6
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
      `limit:${limitPerMedia}`,
      ...orderedMedia.map((item) => `media:${item.id}:${item.slug}`)
    ],
    loader: async () => {
      const previews = await listGlossaryPreviewEntries(
        database,
        media.map((item) => item.id),
        limitPerMedia
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
    tags: buildGlossaryReviewTags(media.map((item) => item.id))
  });

  return new Map(
    previewRows.map((row) => [row.mediaId, row.previews] as const)
  );
}

async function buildMediaShellSnapshot(
  database: DatabaseClient,
  media:
    | MediaListItem
    | NonNullable<Awaited<ReturnType<typeof getMediaBySlugCached>>>,
  options: {
    includeReviewCounts?: boolean;
  } = {}
): Promise<MediaShellSnapshot> {
  const reviewCountsPromise =
    options.includeReviewCounts === false
      ? Promise.resolve(undefined)
      : loadMediaReviewCounts(database, media.id);
  const [lessons, glossarySnapshots, previewEntriesByMedia, reviewCounts] =
    await Promise.all([
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
      ], 4),
      reviewCountsPromise
    ]);
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
    reviewCounts
  });
}

async function loadMediaReviewCounts(
  database: DatabaseClient,
  mediaId: string
) {
  const nowIso = new Date().toISOString();
  const [reviewCandidate, dailyLimit, newIntroducedTodayCount] =
    await Promise.all([
      loadReviewLaunchCandidateByMediaIdCached(database, mediaId, nowIso),
      getReviewDailyLimit(database),
      loadReviewIntroducedTodayCountCached(database, new Date(nowIso))
    ]);

  return {
    activeReviewCards: reviewCandidate?.activeReviewCards ?? 0,
    cardsTotal: reviewCandidate?.cardsTotal ?? 0,
    dueCount: reviewCandidate?.dueCount ?? 0,
    newQueuedCount: Math.min(
      reviewCandidate?.newCount ?? 0,
      Math.max(dailyLimit - newIntroducedTodayCount, 0)
    )
  };
}

export { pickFocusMedia };
export type { MediaShellSnapshot };

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
