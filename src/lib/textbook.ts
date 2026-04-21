import { unstable_noStore as noStore } from "next/cache";

import {
  db,
  getLessonAstBySlug,
  getLessonIdBySlug,
  listLessonEntryLinks,
  listLessonsByMediaId,
  type DatabaseClient,
  type LessonListItem
} from "@/db";
import {
  buildTextbookTooltipTags,
  canUseDataCache,
  getMediaBySlugCached,
  GLOSSARY_SUMMARY_TAG,
  MEDIA_LIST_TAG,
  REVIEW_SUMMARY_TAG,
  runWithTaggedCache,
  SETTINGS_TAG
} from "@/lib/data-cache";
import { mediaGlossaryHref } from "@/lib/site";
import { getFuriganaModeSetting, type FuriganaMode } from "@/lib/settings";
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
  const mediaPromise =
    options.resolvedMedia !== undefined
      ? Promise.resolve(options.resolvedMedia)
      : getMediaBySlugCached(database, mediaSlug);
  const furiganaMode =
    options.resolvedFuriganaMode ?? (await getFuriganaMode(database));

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["textbook", "index", mediaSlug, `furigana:${furiganaMode}`],
    loader: async () => {
      const media = await mediaPromise;

      if (!media) {
        return null;
      }

      return getTextbookIndexDataForMedia(media, furiganaMode, database);
    },
    tags: [MEDIA_LIST_TAG, SETTINGS_TAG]
  });
}

export async function getTextbookLessonData(
  mediaSlug: string,
  lessonSlug: string,
  database: DatabaseClient = db
): Promise<TextbookLessonData | null> {
  markDataAsLive();

  const mediaPromise = getMediaBySlugCached(database, mediaSlug);
  const furiganaModePromise = getFuriganaMode(database);
  const media = await mediaPromise;

  if (!media) {
    await furiganaModePromise;
    return null;
  }

  const lessonPromise = getTextbookLessonBodyData({
    database,
    lessonSlug,
    mediaSlug,
    mediaId: media.id
  });
  const furiganaMode = await furiganaModePromise;
  const indexModelPromise = getTextbookIndexData(mediaSlug, database, {
    resolvedFuriganaMode: furiganaMode,
    resolvedMedia: media
  });
  const [indexModel, lesson] = await Promise.all([
    indexModelPromise,
    lessonPromise
  ]);

  if (!indexModel || !lesson) {
    return null;
  }

  const currentIndex = indexModel.lessons.findIndex(
    (item) => item.id === lesson.id
  );

  if (currentIndex < 0) {
    return null;
  }

  const currentLesson = indexModel.lessons[currentIndex]!;

  return {
    ...indexModel,
    lesson: {
      ast: lesson.ast,
      completedAt: currentLesson.completedAt,
      difficulty: currentLesson.difficulty,
      excerpt: currentLesson.excerpt,
      id: currentLesson.id,
      segmentTitle: currentLesson.segmentTitle,
      slug: currentLesson.slug,
      status: currentLesson.status,
      statusLabel: currentLesson.statusLabel,
      summary: currentLesson.summary,
      title: currentLesson.title
    },
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
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["textbook", "tooltips", mediaSlug, lessonSlug],
    loader: async () => {
      const media = await getMediaBySlugCached(database, mediaSlug);

      if (!media) {
        return null;
      }

      return loadTextbookLessonTooltipEntries(
        media.id,
        mediaSlug,
        lessonSlug,
        database
      );
    },
    tags: [
      ...buildTextbookTooltipTags({ mediaSlug, lessonSlug }),
      GLOSSARY_SUMMARY_TAG,
      REVIEW_SUMMARY_TAG
    ]
  });
}

async function loadTextbookLessonTooltipEntries(
  mediaId: string,
  mediaSlug: string,
  lessonSlug: string,
  database: DatabaseClient
): Promise<TextbookTooltipEntry[] | null> {
  const lesson = await getLessonIdBySlug(database, mediaId, lessonSlug);

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
  mediaSlug: string;
  mediaId: string;
}) {
  return runWithTaggedCache({
    enabled: canUseDataCache(input.database),
    keyParts: ["textbook", "lesson-body", input.mediaSlug, input.lessonSlug],
    loader: () =>
      loadTextbookLessonBodyData(
        input.database,
        input.mediaId,
        input.lessonSlug
      ),
    tags: [MEDIA_LIST_TAG]
  });
}

async function loadTextbookLessonBodyData(
  database: DatabaseClient,
  mediaId: string,
  lessonSlug: string
) {
  const lesson = await getLessonAstBySlug(database, mediaId, lessonSlug);

  if (!lesson) {
    return null;
  }

  return {
    ast: parseLessonAst(lesson.content?.astJson ?? null),
    id: lesson.id
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
