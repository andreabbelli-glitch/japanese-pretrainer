import type { Route } from "next";
import { unstable_noStore as noStore } from "next/cache";

import {
  db,
  getLessonReaderBySlug,
  getLessonTooltipSourceBySlug,
  getMediaBySlug,
  listLessonEntryLinks,
  listLessonsByMediaId,
  type DatabaseClient,
  type LessonListItem
} from "@/db";
import {
  canUseDataCache,
  MEDIA_LIST_TAG,
  runWithTaggedCache,
  SETTINGS_TAG
} from "@/lib/data-cache";
import { mediaGlossaryHref } from "@/lib/site";
import type { MarkdownDocument } from "@/lib/content/types";
import {
  getFuriganaModeSetting,
  type FuriganaMode
} from "@/lib/settings";
import type { PronunciationData } from "@/lib/pronunciation";
import { pickBestBy } from "@/lib/collections";
import {
  calculatePercent,
  compareIsoDates,
  formatLessonProgressStatusLabel,
  formatMediaTypeLabel,
  formatSegmentKindLabel
} from "@/lib/study-format";
import { parseTextbookDocument } from "@/lib/textbook-document";
import { loadLessonTooltipEntries } from "@/lib/textbook-tooltips";

export type { FuriganaMode } from "@/lib/settings";
export {
  applyLessonOpenedState,
  recordLessonOpened,
  setFuriganaMode,
  setLessonCompletionState,
  settleLessonOpenedStateForRender
} from "@/lib/textbook-progress";

export type TextbookLessonNavItem = {
  id: string;
  slug: string;
  title: string;
  orderIndex: number;
  difficulty: string | null;
  summary: string | null;
  excerpt: string | null;
  status: "not_started" | "in_progress" | "completed";
  statusLabel: string;
  segmentId: string | null;
  segmentTitle: string;
  lastOpenedAt: string | null;
  completedAt: string | null;
};

export type TextbookLessonGroup = {
  id: string;
  title: string;
  note: string | null;
  completedLessons: number;
  totalLessons: number;
  lessons: TextbookLessonNavItem[];
};

export type TextbookEntryTooltip = {
  id: string;
  crossMediaHint?: {
    otherMediaCount: number;
  };
  kind: "term" | "grammar";
  label: string;
  title?: string;
  reading?: string;
  romaji?: string;
  meaning: string;
  literalMeaning?: string;
  notes?: string;
  pos?: string;
  levelHint?: string;
  pronunciation?: PronunciationData;
  statusLabel: string;
  segmentTitle?: string;
  glossaryHref: Route;
};

export type TextbookCardTooltip = {
  id: string;
  kind: "card";
  label: string;
  reading?: string;
  meaning: string;
  notes?: string;
  pronunciation?: PronunciationData;
  typeLabel: string;
  statusLabel: string;
  segmentTitle?: string;
  reviewHref: Route;
};

export type TextbookTooltipEntry = TextbookEntryTooltip | TextbookCardTooltip;

export type TextbookIndexData = {
  media: {
    id: string;
    slug: string;
    title: string;
    description: string;
    mediaTypeLabel: string;
    segmentKindLabel: string;
  };
  furiganaMode: FuriganaMode;
  lessons: TextbookLessonNavItem[];
  groups: TextbookLessonGroup[];
  activeLesson: TextbookLessonNavItem | null;
  resumeLesson: TextbookLessonNavItem | null;
  completedLessons: number;
  totalLessons: number;
  textbookProgressPercent: number | null;
  glossaryHref: Route;
};

export type TextbookLessonData = TextbookIndexData & {
  lesson: {
    id: string;
    slug: string;
    title: string;
    difficulty: string | null;
    summary: string | null;
    excerpt: string | null;
    status: "not_started" | "in_progress" | "completed";
    statusLabel: string;
    segmentTitle: string;
    ast: MarkdownDocument | null;
  };
  entries: TextbookTooltipEntry[];
  previousLesson: TextbookLessonNavItem | null;
  nextLesson: TextbookLessonNavItem | null;
};

export async function getFuriganaMode(
  database: DatabaseClient = db
): Promise<FuriganaMode> {
  return getFuriganaModeSetting(database);
}

export async function getTextbookIndexData(
  mediaSlug: string,
  database: DatabaseClient = db
): Promise<TextbookIndexData | null> {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["textbook", "index", mediaSlug],
    loader: async () => {
      const media = await getMediaBySlug(database, mediaSlug);

      if (!media) {
        return null;
      }

      return getTextbookIndexDataForMedia(media, database);
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

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const [indexModel, lesson] = await Promise.all([
    getTextbookIndexDataForMedia(media, database),
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
  markDataAsLive();

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const lesson = await getLessonTooltipSourceBySlug(
    database,
    media.id,
    lessonSlug
  );

  if (!lesson) {
    return null;
  }

  // Parse AST synchronously while the entry-link query runs in parallel.
  const lessonDocument = parseLessonAst(lesson.content?.astJson ?? null);
  const imageCardIds = collectImageCardIds(lessonDocument);
  const lessonEntryLinks = await listLessonEntryLinks(database, lesson.id);

  return loadLessonTooltipEntries({
    database,
    lessonEntryLinks,
    imageCardIds,
    mediaSlug
  });
}

async function getTextbookIndexDataForMedia(
  media: NonNullable<Awaited<ReturnType<typeof getMediaBySlug>>>,
  database: DatabaseClient
) {
  const [lessons, furiganaMode] = await Promise.all([
    listLessonsByMediaId(database, media.id),
    getFuriganaMode(database)
  ]);

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
  media: NonNullable<Awaited<ReturnType<typeof getMediaBySlug>>>;
  lessons: LessonListItem[];
  furiganaMode: FuriganaMode;
}): TextbookIndexData {
  const lessons = input.lessons.map(mapLessonNavItem);
  const completedLessons = lessons.filter(
    (lesson) => lesson.status === "completed"
  ).length;

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
    groups: groupLessons(lessons, input.lessons),
    activeLesson: selectActiveLesson(lessons),
    resumeLesson: selectResumeLesson(lessons),
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

function groupLessons(
  lessonItems: TextbookLessonNavItem[],
  sourceLessons: LessonListItem[]
) {
  const groups = new Map<string, TextbookLessonGroup>();

  sourceLessons.forEach((lesson, index) => {
    const lessonItem = lessonItems[index];
    const key = lesson.segment?.id ?? "__ungrouped__";
    const existing = groups.get(key);

    if (existing) {
      existing.lessons.push(lessonItem);
      existing.totalLessons += 1;
      existing.completedLessons += lessonItem.status === "completed" ? 1 : 0;
      return;
    }

    groups.set(key, {
      id: key,
      title: lesson.segment?.title ?? "Percorso principale",
      note: lesson.segment?.notes ?? null,
      completedLessons: lessonItem.status === "completed" ? 1 : 0,
      totalLessons: 1,
      lessons: [lessonItem]
    });
  });

  return [...groups.values()];
}

function selectActiveLesson(lessons: TextbookLessonNavItem[]) {
  return pickBestBy(
    lessons.filter((lesson) => lesson.status === "in_progress"),
    (left, right) => compareIsoDates(right.lastOpenedAt, left.lastOpenedAt)
  );
}

function selectResumeLesson(lessons: TextbookLessonNavItem[]) {
  return (
    lessons.find((lesson) => lesson.status !== "completed") ??
    lessons[0] ??
    null
  );
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

function collectImageCardIds(document: MarkdownDocument | null) {
  if (!document) {
    return [];
  }

  const cardIds = new Set<string>();

  for (const block of document.blocks) {
    if (block.type === "image" && block.cardId) {
      cardIds.add(block.cardId);
    }
  }

  return [...cardIds];
}

function markDataAsLive() {
  try {
    noStore();
  } catch {
    // Tests can execute these helpers outside a request.
  }
}
