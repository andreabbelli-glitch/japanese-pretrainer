import { unstable_noStore as noStore } from "next/cache";

import {
  db,
  getLessonReaderBySlug,
  getLessonTooltipSourceBySlug,
  listLessonEntryLinks,
  listLessonsByMediaId,
  type DatabaseClient,
  type LessonListItem
} from "@/db";
import {
  buildGlossarySummaryTags,
  buildReviewSummaryTags,
  buildTextbookTooltipTags,
  canUseDataCache,
  getMediaBySlugCached,
  MEDIA_LIST_TAG,
  runWithTaggedCache,
  SETTINGS_TAG
} from "@/lib/data-cache";
import { mediaGlossaryHref } from "@/lib/site";
import {
  getFuriganaModeSetting,
  type FuriganaMode
} from "@/lib/settings";
import {
  calculatePercent,
  compareIsoDates,
  formatLessonProgressStatusLabel,
  formatMediaTypeLabel,
  formatSegmentKindLabel
} from "@/lib/study-format";
import { parseTextbookDocument } from "@/lib/textbook-document";
import { loadLessonTooltipEntries } from "@/lib/textbook-tooltips";
import type {
  TextbookIndexData,
  TextbookLessonData,
  TextbookLessonGroup,
  TextbookLessonNavItem,
  TextbookTooltipEntry
} from "@/lib/textbook-types";

export type { FuriganaMode } from "@/lib/settings";
export type {
  TextbookEntryTooltip,
  TextbookIndexData,
  TextbookLessonData,
  TextbookLessonGroup,
  TextbookLessonNavItem,
  TextbookTooltipEntry
} from "@/lib/textbook-types";
export {
  applyLessonOpenedState,
  recordLessonOpened,
  setFuriganaMode,
  setLessonCompletionState,
  settleLessonOpenedStateForRender
} from "@/lib/textbook-progress";

type ResolvedMedia = NonNullable<
  Awaited<ReturnType<typeof getMediaBySlugCached>>
>;

export async function getFuriganaMode(
  database: DatabaseClient = db
): Promise<FuriganaMode> {
  return getFuriganaModeSetting(database);
}

export async function getTextbookIndexData(
  mediaSlug: string,
  database: DatabaseClient = db,
  options: {
    resolvedFuriganaMode?: FuriganaMode;
    resolvedMedia?: ResolvedMedia | null;
  } = {}
): Promise<TextbookIndexData | null> {
  const media =
    options.resolvedMedia ??
    (await getMediaBySlugCached(database, mediaSlug));

  if (!media) {
    return null;
  }

  const furiganaMode =
    options.resolvedFuriganaMode ?? (await getFuriganaMode(database));

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["textbook", "index", mediaSlug, `furigana:${furiganaMode}`],
    loader: () => getTextbookIndexDataForMedia(media, furiganaMode, database),
    tags: [MEDIA_LIST_TAG, SETTINGS_TAG]
  });
}

export async function getTextbookLessonData(
  mediaSlug: string,
  lessonSlug: string,
  database: DatabaseClient = db
): Promise<TextbookLessonData | null> {
  markDataAsLive();

  const media = await getMediaBySlugCached(database, mediaSlug);

  if (!media) {
    return null;
  }

  const indexModelPromise = getFuriganaMode(database).then((furiganaMode) =>
    getTextbookIndexData(mediaSlug, database, {
      resolvedFuriganaMode: furiganaMode,
      resolvedMedia: media
    })
  );
  const [indexModel, lesson] = await Promise.all([
    indexModelPromise,
    getTextbookLessonBodyData({
      database,
      lessonSlug,
      mediaId: media.id
    })
  ]);

  if (!indexModel || !lesson) {
    return null;
  }

  const currentIndex = indexModel.lessons.findIndex(
    (item) => item.id === lesson.lesson.id
  );

  return {
    ...indexModel,
    lesson: lesson.lesson,
    entries: [],
    previousLesson:
      currentIndex > 0 ? indexModel.lessons[currentIndex - 1] : null,
    nextLesson:
      currentIndex >= 0 && currentIndex < indexModel.lessons.length - 1
        ? indexModel.lessons[currentIndex + 1]
        : null
  };
}

export async function getTextbookLessonTooltipEntries(
  mediaSlug: string,
  lessonSlug: string,
  database: DatabaseClient = db
): Promise<TextbookTooltipEntry[] | null> {
  const media = await getMediaBySlugCached(database, mediaSlug);

  if (!media) {
    return null;
  }

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["textbook", "tooltips", mediaSlug, lessonSlug],
    loader: () =>
      loadTextbookLessonTooltipEntries(
        media.id,
        mediaSlug,
        lessonSlug,
        database
      ),
    tags: [
      ...buildTextbookTooltipTags({ mediaSlug, lessonSlug }),
      ...buildGlossarySummaryTags([media.id]),
      ...buildReviewSummaryTags([media.id])
    ]
  });
}

async function loadTextbookLessonTooltipEntries(
  mediaId: string,
  mediaSlug: string,
  lessonSlug: string,
  database: DatabaseClient
): Promise<TextbookTooltipEntry[] | null> {
  const lesson = await getLessonTooltipSourceBySlug(
    database,
    mediaId,
    lessonSlug
  );

  if (!lesson) {
    return null;
  }

  const lessonEntryLinks = await listLessonEntryLinks(database, lesson.id);

  return loadLessonTooltipEntries({
    database,
    lessonEntryLinks,
    mediaSlug
  });
}

async function getTextbookIndexDataForMedia(
  media: ResolvedMedia,
  furiganaMode: FuriganaMode,
  database: DatabaseClient
) {
  const lessons = await listLessonsByMediaId(database, media.id);

  return buildTextbookIndexModel({
    furiganaMode,
    lessons,
    media
  });
}

async function getTextbookLessonBodyData(input: {
  database: DatabaseClient;
  lessonSlug: string;
  mediaId: string;
}) {
  const lesson = await getLessonReaderBySlug(
    input.database,
    input.mediaId,
    input.lessonSlug
  );

  if (!lesson) {
    return null;
  }

  const lessonAst = parseLessonAst(lesson.content?.astJson ?? null);

  return {
    lesson: {
      ast: lessonAst,
      completedAt: lesson.progress?.completedAt ?? null,
      difficulty: lesson.difficulty,
      excerpt: lesson.content?.excerpt ?? null,
      id: lesson.id,
      segmentTitle: lesson.segment?.title ?? "Percorso principale",
      slug: lesson.slug,
      status: normalizeLessonStatus(lesson.progress?.status ?? null),
      statusLabel: formatLessonProgressStatusLabel(
        lesson.progress?.status ?? null
      ),
      summary: lesson.summary,
      title: lesson.title
    }
  };
}

function buildTextbookIndexModel(input: {
  media: NonNullable<Awaited<ReturnType<typeof getMediaBySlugCached>>>;
  lessons: LessonListItem[];
  furiganaMode: FuriganaMode;
}): TextbookIndexData {
  const lessons: TextbookLessonNavItem[] = [];
  const groups = new Map<string, TextbookLessonGroup>();
  let activeLesson: TextbookLessonNavItem | null = null;
  let resumeLesson: TextbookLessonNavItem | null = null;
  let completedLessons = 0;

  for (const sourceLesson of input.lessons) {
    const lessonItem = mapLessonNavItem(sourceLesson);
    const isCompleted = lessonItem.status === "completed";
    const groupKey = sourceLesson.segment?.id ?? "__ungrouped__";
    const existingGroup = groups.get(groupKey);

    lessons.push(lessonItem);

    if (isCompleted) {
      completedLessons++;
    } else if (!resumeLesson) {
      resumeLesson = lessonItem;
    }

    if (
      lessonItem.status === "in_progress" &&
      (!activeLesson ||
        compareIsoDates(activeLesson.lastOpenedAt, lessonItem.lastOpenedAt) < 0)
    ) {
      activeLesson = lessonItem;
    }

    if (existingGroup) {
      existingGroup.lessons.push(lessonItem);
      existingGroup.totalLessons += 1;
      existingGroup.completedLessons += isCompleted ? 1 : 0;
      continue;
    }

    groups.set(groupKey, {
      id: groupKey,
      title: sourceLesson.segment?.title ?? "Percorso principale",
      note: sourceLesson.segment?.notes ?? null,
      completedLessons: isCompleted ? 1 : 0,
      totalLessons: 1,
      lessons: [lessonItem]
    });
  }

  return {
    media: {
      id: input.media.id,
      slug: input.media.slug,
      title: input.media.title,
      description:
        input.media.description ??
        `${input.media.title} è pronto per una lettura ordinata e facile da seguire.`,
      mediaTypeLabel: formatMediaTypeLabel(input.media.mediaType),
      segmentKindLabel: formatSegmentKindLabel(input.media.segmentKind)
    },
    furiganaMode: input.furiganaMode,
    lessons,
    groups: [...groups.values()],
    activeLesson,
    resumeLesson: resumeLesson ?? lessons[0] ?? null,
    completedLessons,
    totalLessons: lessons.length,
    textbookProgressPercent: calculatePercent(completedLessons, lessons.length),
    glossaryHref: mediaGlossaryHref(input.media.slug)
  };
}

function mapLessonNavItem(lesson: LessonListItem): TextbookLessonNavItem {
  const status = normalizeLessonStatus(lesson.progress?.status ?? null);

  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    orderIndex: lesson.orderIndex,
    difficulty: lesson.difficulty ?? null,
    summary: lesson.summary ?? null,
    excerpt: lesson.content?.excerpt ?? null,
    status,
    statusLabel: formatLessonProgressStatusLabel(status),
    segmentId: lesson.segment?.id ?? null,
    segmentTitle: lesson.segment?.title ?? "Percorso principale",
    lastOpenedAt: lesson.progress?.lastOpenedAt ?? null,
    completedAt: lesson.progress?.completedAt ?? null
  };
}

function normalizeLessonStatus(
  value: string | null
): "not_started" | "in_progress" | "completed" {
  if (value === "in_progress" || value === "completed") {
    return value;
  }

  return "not_started";
}

function parseLessonAst(astJson: string | null) {
  return parseTextbookDocument(astJson);
}

function markDataAsLive() {
  try {
    noStore();
  } catch {
    // Tests can execute these helpers outside a request.
  }
}
