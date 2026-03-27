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
import {
  buildReviewOverviewSnapshot,
  loadReviewLaunchCandidatesCached,
  loadReviewOverviewSnapshots
} from "@/lib/review";
import { pickBestBy } from "@/lib/collections";
import { getReviewDailyLimit } from "@/lib/settings";
import {
  buildLessonMetrics,
  buildEmptyGlossaryProgressSnapshot,
  loadGlossaryProgressSnapshots,
  loadGlossaryProgressSnapshot,
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
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["app-shell", "dashboard"],
    loader: () => loadDashboardData(database),
    tags: [
      MEDIA_LIST_TAG,
      GLOSSARY_SUMMARY_TAG,
      REVIEW_SUMMARY_TAG,
      REVIEW_FIRST_CANDIDATE_TAG,
      SETTINGS_TAG
    ]
  });
}

async function loadDashboardData(
  database: DatabaseClient
): Promise<DashboardData> {
  const rows = await listMediaCached(database);
  const media = await buildMediaShellSnapshots(database, rows);
  const focusMedia = pickFocusMedia(media);
  const reviewMedia = pickReviewMedia(media);

  return {
    focusMedia,
    reviewMedia,
    media,
    totals: {
      cardsDue: media.reduce((sum, item) => sum + item.cardsDue, 0),
      lessonsCompleted: media.reduce(
        (sum, item) => sum + item.lessonsCompleted,
        0
      ),
      lessonsTotal: media.reduce((sum, item) => sum + item.lessonsTotal, 0),
      entriesKnown: media.reduce((sum, item) => sum + item.entriesKnown, 0),
      entriesTotal: media.reduce((sum, item) => sum + item.entriesTotal, 0),
      activeReviewCards: media.reduce(
        (sum, item) => sum + item.activeReviewCards,
        0
      )
    }
  };
}

export async function getMediaLibraryData(database: DatabaseClient = db) {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["app-shell", "media-library"],
    loader: async () => {
      const rows = await listMediaCached(database);

      return buildMediaShellSnapshots(database, rows);
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
  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  return buildMediaShellSnapshot(database, media);
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
        snapshot:
          snapshots.get(item.id) ??
          buildEmptyGlossaryProgressSnapshot()
      }));
    },
    tags: buildGlossarySummaryTags(media.map((item) => item.id))
  });

  return new Map(
    snapshotRows.map((row) => [row.mediaId, row.snapshot] as const)
  );
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

async function buildMediaShellSnapshots(
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

async function buildMediaShellSnapshot(
  database: DatabaseClient,
  media: MediaListItem | NonNullable<Awaited<ReturnType<typeof getMediaBySlug>>>
): Promise<MediaShellSnapshot> {
  const nowIso = new Date().toISOString();
  const [lessons, glossary, review] = await Promise.all([
    listLessonsByMediaId(database, media.id),
    loadGlossaryProgressSnapshotsCached(database, [
      {
        id: media.id,
        slug: media.slug
      }
    ]).then(
      (snapshots) =>
        snapshots.get(media.id) ??
        buildEmptyGlossaryProgressSnapshot()
    ),
    loadReviewOverviewSnapshots(database, [
      {
        id: media.id,
        slug: media.slug
      }
    ]).then(
      (snapshots) =>
        snapshots.get(media.id) ??
        buildReviewOverviewSnapshot({
          cards: [],
          dailyLimit: 0,
          entryLookup: new Map(),
          extraNewCount: 0,
          newIntroducedTodayCount: 0,
          nowIso,
          subjectStates: new Map()
        })
    )
  ]);

  return mapMediaShellSnapshot({
    glossary,
    lessons,
    media,
    review
  });
}

function pickFocusMedia(media: MediaShellSnapshot[]) {
  return pickBestBy(media, (left, right) => {
    return scoreMediaFocus(left) - scoreMediaFocus(right);
  });
}

function pickReviewMedia(media: MediaShellSnapshot[]) {
  return pickBestBy(media, (left, right) => {
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
    resumeLesson,
    nextLesson,
    segments
  } = buildLessonMetrics(input.lessons);
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
    activeLesson,
    resumeLesson,
    nextLesson,
    segments,
    previewEntries: input.glossary.previewEntries
  };
}

function buildReviewSignals({
  cardsDue,
  activeReviewCards,
  cardsTotal,
  review
}: {
  cardsDue: number;
  activeReviewCards: number;
  cardsTotal: number;
  review: ReturnType<typeof buildReviewOverviewSnapshot>;
}) {
  const nextCardFront = review.nextCardFront;

  if (review.queueCount > 0) {
    return {
      value:
        review.dueCount > 0
          ? `${review.dueCount} da ripassare`
          : review.newQueuedCount > 0
            ? "Nuove pronte"
            : `${review.queueCount} in coda`,
      detail: nextCardFront
        ? `Prossima card: ${nextCardFront}`
        : "Sessione pronta",
      queueLabel: review.queueLabel
    };
  }

  if (cardsDue > 0) {
    return {
      value: `${cardsDue} da ripassare`,
      detail: nextCardFront
        ? `Prossima card: ${nextCardFront}`
        : "Richiedono attenzione adesso",
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

function mapMediaShellSnapshot(input: {
  glossary: Awaited<ReturnType<typeof loadGlossaryProgressSnapshot>>;
  lessons: Awaited<ReturnType<typeof listLessonsByMediaId>>;
  media:
    | MediaListItem
    | NonNullable<Awaited<ReturnType<typeof getMediaBySlug>>>;
  review: ReturnType<typeof buildReviewOverviewSnapshot>;
}): MediaShellSnapshot {
  const {
    lessonsCompleted,
    lessonsTotal,
    activeLesson,
    resumeLesson,
    nextLesson,
    segments
  } = buildLessonMetrics(input.lessons);
  const reviewSignals = buildReviewSignals({
    activeReviewCards: input.review.activeCards,
    cardsDue: input.review.dueCount,
    cardsTotal: input.review.totalCards,
    review: input.review
  });

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
    cardsDue: input.review.dueCount,
    cardsTotal: input.review.totalCards,
    activeReviewCards: input.review.activeCards,
    reviewStatValue: reviewSignals.value,
    reviewStatDetail: reviewSignals.detail,
    reviewQueueLabel: reviewSignals.queueLabel,
    activeLesson,
    resumeLesson,
    nextLesson,
    segments,
    previewEntries: input.glossary.previewEntries
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
