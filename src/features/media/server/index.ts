import { db, type DatabaseClient } from "@/db";
import {
  listGlossaryPreviewEntries,
  listGlossaryProgressSummaries,
  listLessonsByMediaId,
  listLessonsByMediaIdsForShell,
  type MediaListItem,
  type ShellLessonListItem
} from "@/db/queries";
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
} from "@/features/cache/server/data-cache";
import { calculatePercent } from "@/features/study/model/format";
import { mediaGlossaryEntryHref } from "@/features/navigation";
import {
  loadReviewIntroducedTodayCountCached,
  loadReviewOverviewSnapshots
} from "@/features/review/server/loader";
import { getReviewDailyLimit } from "@/features/settings/server";
import { formatDerivedStudyStateLabel } from "@/features/study/model/entry";
import {
  buildEmptyGlossaryProgressSnapshot,
  type GlossaryProgressSnapshot,
  type StudyEntryPreview
} from "@/features/study/model/metrics";
import {
  mapMediaShellSnapshotFromCounts,
  pickFocusMedia,
  type MediaShellSnapshot
} from "@/features/media/model/shell-snapshot";
import { getLocalIsoTimeBucketKey } from "@/features/shared/model/local-date";
import type { ReviewOverviewSnapshot } from "@/features/review/types";

function buildGlossaryReviewTags(mediaIds: string[] = []) {
  return [
    ...buildGlossarySummaryTags(mediaIds),
    ...buildReviewSummaryTags(mediaIds)
  ];
}

type ResolvedMedia = NonNullable<
  Awaited<ReturnType<typeof getMediaBySlugCached>>
>;

export async function getMediaLibraryData(database: DatabaseClient = db) {
  const now = new Date();
  const cacheBucketKey = getLocalIsoTimeBucketKey(now);

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["app-shell", "media-library", `bucket:${cacheBucketKey}`],
    loader: async () => {
      const mediaRowsPromise = listMediaCached(database);
      const dailyLimitPromise = getReviewDailyLimit(database);
      const newIntroducedTodayCountPromise =
        loadReviewIntroducedTodayCountCached(database, now);
      const [rows, resolvedDailyLimit, resolvedNewIntroducedTodayCount] =
        await Promise.all([
          mediaRowsPromise,
          dailyLimitPromise,
          newIntroducedTodayCountPromise
        ]);

      return loadMediaShellSnapshots(database, rows, {
        includePreviewEntries: false,
        now,
        resolvedDailyLimit,
        resolvedNewIntroducedTodayCount
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
    includePreviewEntries?: boolean;
    resolvedMedia?: ResolvedMedia | null;
  } = {}
) {
  const media =
    options.resolvedMedia ?? (await getMediaBySlugCached(database, mediaSlug));

  if (!media) {
    return null;
  }

  const now = new Date();
  const keyParts = [
    "app-shell",
    "media-detail",
    mediaSlug,
    options.includeReviewCounts === false ? "study-only" : "full"
  ];
  const includePreviewEntries = options.includePreviewEntries !== false;

  if (!includePreviewEntries) {
    keyParts.push("no-preview");
  }

  if (options.includeReviewCounts !== false) {
    keyParts.push(`bucket:${getLocalIsoTimeBucketKey(now)}`);
  }

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts,
    loader: () =>
      buildMediaShellSnapshot(database, media, {
        includePreviewEntries,
        includeReviewCounts: options.includeReviewCounts,
        now
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
    resolvedReviewSnapshots?: Map<string, ReviewOverviewSnapshot>;
    now?: Date;
  } = {}
) {
  if (media.length === 0) {
    return [];
  }

  const now = options.now ?? new Date();
  const dailyLimitPromise =
    options.resolvedDailyLimit != null
      ? Promise.resolve(options.resolvedDailyLimit)
      : getReviewDailyLimit(database);
  const newIntroducedTodayCountPromise =
    options.resolvedNewIntroducedTodayCount != null
      ? Promise.resolve(options.resolvedNewIntroducedTodayCount)
      : loadReviewIntroducedTodayCountCached(database, now);
  const reviewSnapshotsPromise =
    options.resolvedReviewSnapshots ??
    Promise.all([dailyLimitPromise, newIntroducedTodayCountPromise]).then(
      ([dailyLimit, newIntroducedTodayCount]) =>
        loadReviewOverviewSnapshots(
          database,
          media.map((item) => ({
            id: item.id,
            slug: item.slug
          })),
          {
            asOf: now,
            globalMediaRows: media,
            resolvedDailyLimit: dailyLimit,
            resolvedNewIntroducedTodayCount: newIntroducedTodayCount
          }
        )
    );
  const mediaIds = media.map((item) => item.id);
  const [lessons, glossarySnapshots, reviewSnapshots] = await Promise.all([
    listLessonsByMediaIdsForShell(database, mediaIds),
    loadGlossaryProgressSummarySnapshotsCached(
      database,
      media.map((item) => ({
        id: item.id,
        slug: item.slug
      }))
    ),
    reviewSnapshotsPromise
  ]);
  const lessonsByMedia = groupLessonsByMedia(lessons);

  const snapshots = media.map((item) => {
    const reviewSnapshot = reviewSnapshots.get(item.id);

    return mapMediaShellSnapshotFromCounts({
      glossary:
        glossarySnapshots.get(item.id) ?? buildEmptyGlossaryProgressSnapshot(),
      lessons: lessonsByMedia.get(item.id) ?? [],
      media: item,
      reviewCounts: {
        activeReviewCards: reviewSnapshot?.activeCards ?? 0,
        cardsTotal: reviewSnapshot?.totalCards ?? 0,
        dueCount: reviewSnapshot?.dueCount ?? 0,
        newQueuedCount: reviewSnapshot?.newQueuedCount ?? 0
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
    ],
    options.previewEntryLimit ?? 1
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
        media,
        limitPerMedia
      );
      const previewsByMedia = new Map<string, StudyEntryPreview[]>();

      for (const preview of previews) {
        const existing = previewsByMedia.get(preview.mediaId) ?? [];

        existing.push({
          href: mediaGlossaryEntryHref(
            preview.mediaSlug,
            preview.kind,
            preview.label,
            {
              sourceId: preview.sourceId
            }
          ),
          id: preview.sourceId,
          kind: preview.kind,
          label: preview.label,
          meaning: preview.meaningIt,
          reading: preview.reading ?? undefined,
          segmentTitle: preview.segmentTitle ?? undefined,
          statusLabel: formatDerivedStudyStateLabel(preview.state)
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
    includePreviewEntries?: boolean;
    includeReviewCounts?: boolean;
    now?: Date;
  } = {}
): Promise<MediaShellSnapshot> {
  const reviewCountsPromise =
    options.includeReviewCounts === false
      ? Promise.resolve(undefined)
      : loadMediaReviewCounts(database, media.id, options.now);
  const previewEntriesByMediaPromise =
    options.includePreviewEntries === false
      ? Promise.resolve(new Map<string, StudyEntryPreview[]>())
      : loadGlossaryPreviewEntriesCached(
          database,
          [
            {
              id: media.id,
              slug: media.slug
            }
          ],
          4
        );
  const [lessons, glossarySnapshots, previewEntriesByMedia, reviewCounts] =
    await Promise.all([
      listLessonsByMediaId(database, media.id),
      loadGlossaryProgressSummarySnapshotsCached(database, [
        {
          id: media.id,
          slug: media.slug
        }
      ]),
      previewEntriesByMediaPromise,
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
  mediaId: string,
  now: Date = new Date()
) {
  const reviewSnapshots = await loadReviewOverviewSnapshots(
    database,
    [{ id: mediaId, slug: mediaId }],
    {
      asOf: now
    }
  );
  const reviewSnapshot = reviewSnapshots.get(mediaId);

  return {
    activeReviewCards: reviewSnapshot?.activeCards ?? 0,
    cardsTotal: reviewSnapshot?.totalCards ?? 0,
    dueCount: reviewSnapshot?.dueCount ?? 0,
    newQueuedCount: reviewSnapshot?.newQueuedCount ?? 0
  };
}

export { pickFocusMedia };
export type { MediaShellSnapshot };

function groupLessonsByMedia(lessons: ShellLessonListItem[]) {
  const grouped = new Map<string, ShellLessonListItem[]>();

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
