import type { Route } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { eq } from "drizzle-orm";

import {
  db,
  getCardsByIds,
  getCrossMediaSiblingCounts,
  getGlossaryEntriesByIds,
  getLessonReaderBySlug,
  getLessonTooltipSourceBySlug,
  getMediaBySlug,
  lessonProgress,
  listEntryStudySignals,
  listLessonEntryLinks,
  listLessonsByMediaId,
  type DatabaseClient,
  type GrammarGlossaryEntry,
  type LessonListItem,
  type CardListItem,
  type TermGlossaryEntry
} from "@/db";
import {
  mediaGlossaryEntryHref,
  mediaGlossaryHref,
  mediaReviewCardHref
} from "@/lib/site";
import type { MarkdownDocument } from "@/lib/content/types";
import {
  getFuriganaModeSetting,
  updateStudySettings,
  type FuriganaMode
} from "@/lib/settings";
import {
  buildPronunciationData,
  type PronunciationData
} from "@/lib/pronunciation";
import { pickBestBy } from "@/lib/collections";
import { buildEntryKey } from "@/lib/entry-id";
import { deriveEntryStudyState } from "@/lib/study-entry";
import {
  calculatePercent,
  compareIsoDates,
  formatLessonProgressStatusLabel,
  formatMediaTypeLabel,
  formatSegmentKindLabel
} from "@/lib/study-format";
import { loadReviewSubjectStateLookup } from "@/lib/review-subject-state-lookup";
import { parseTextbookDocument } from "@/lib/textbook-document";

export type { FuriganaMode } from "@/lib/settings";

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

type LessonOpenState = {
  lastOpenedAt: string;
  startedAt: string;
  status: "in_progress" | "completed";
};

type StudySignalRow = Awaited<ReturnType<typeof listEntryStudySignals>>[number];

export async function getFuriganaMode(
  database: DatabaseClient = db
): Promise<FuriganaMode> {
  return getFuriganaModeSetting(database);
}

export async function getTextbookIndexData(
  mediaSlug: string,
  database: DatabaseClient = db
): Promise<TextbookIndexData | null> {
  markDataAsLive();

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

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

  const lessonEntryLinks = await listLessonEntryLinks(database, lesson.id);

  return loadLessonTooltipEntries({
    database,
    lessonEntryLinks,
    imageCardIds: collectLessonImageCardIds(lesson.content?.astJson ?? null),
    mediaSlug
  });
}

export async function recordLessonOpened(
  lessonId: string,
  database: DatabaseClient = db
): Promise<LessonOpenState> {
  const nowIso = new Date().toISOString();
  const existing = await database.query.lessonProgress.findFirst({
    where: eq(lessonProgress.lessonId, lessonId)
  });

  if (!existing) {
    await database.insert(lessonProgress).values({
      lessonId,
      status: "in_progress",
      startedAt: nowIso,
      completedAt: null,
      lastOpenedAt: nowIso
    });

    return {
      lastOpenedAt: nowIso,
      startedAt: nowIso,
      status: "in_progress"
    };
  }

  const nextStatus =
    existing.status === "completed" ? "completed" : "in_progress";
  const nextStartedAt =
    existing.status === "not_started" || existing.startedAt === null
      ? nowIso
      : existing.startedAt;

  await database
    .update(lessonProgress)
    .set({
      status: nextStatus,
      startedAt: nextStartedAt,
      completedAt:
        existing.status === "completed" ? existing.completedAt : null,
      lastOpenedAt: nowIso
    })
    .where(eq(lessonProgress.lessonId, lessonId));

  return {
    lastOpenedAt: nowIso,
    startedAt: nextStartedAt,
    status: nextStatus
  };
}

export async function setLessonCompletionState(
  lessonId: string,
  completed: boolean,
  database: DatabaseClient = db
) {
  const nowIso = new Date().toISOString();
  const existing = await database.query.lessonProgress.findFirst({
    where: eq(lessonProgress.lessonId, lessonId)
  });

  if (!existing) {
    await database.insert(lessonProgress).values({
      lessonId,
      status: completed ? "completed" : "in_progress",
      startedAt: nowIso,
      completedAt: completed ? nowIso : null,
      lastOpenedAt: nowIso
    });

    return;
  }

  await database
    .update(lessonProgress)
    .set({
      status: completed ? "completed" : "in_progress",
      startedAt: existing.startedAt ?? nowIso,
      completedAt: completed ? nowIso : null,
      lastOpenedAt: nowIso
    })
    .where(eq(lessonProgress.lessonId, lessonId));
}

export async function setFuriganaMode(
  mode: FuriganaMode,
  database: DatabaseClient = db
) {
  await updateStudySettings(
    {
      furiganaMode: mode
    },
    database
  );
}

export function applyLessonOpenedState(
  data: TextbookLessonData,
  openedState: LessonOpenState
): TextbookLessonData {
  if (data.lesson.status === openedState.status) {
    return data;
  }

  const nextStatus = openedState.status;
  const nextStatusLabel = formatLessonProgressStatusLabel(nextStatus);
  const updateLessonNavItem = (lesson: TextbookLessonNavItem) =>
    lesson.id === data.lesson.id
      ? {
          ...lesson,
          lastOpenedAt: openedState.lastOpenedAt,
          status: nextStatus,
          statusLabel: nextStatusLabel
        }
      : lesson;
  const lessons = data.lessons.map(updateLessonNavItem);
  const groups = data.groups.map((group) => ({
    ...group,
    lessons: group.lessons.map(updateLessonNavItem)
  }));

  return {
    ...data,
    activeLesson:
      lessons.find((lesson) => lesson.id === data.lesson.id) ??
      data.activeLesson,
    groups,
    lesson: {
      ...data.lesson,
      status: nextStatus,
      statusLabel: nextStatusLabel
    },
    lessons
  };
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

async function loadLessonTooltipEntries(input: {
  database: DatabaseClient;
  lessonEntryLinks: Awaited<ReturnType<typeof listLessonEntryLinks>>;
  imageCardIds: string[];
  mediaSlug: string;
}) {
  const uniqueLessonEntryLinks = dedupeLessonEntryLinks(input.lessonEntryLinks);
  const termIds = uniqueLessonEntryLinks
    .filter((entry) => entry.entryType === "term")
    .map((entry) => entry.entryId);
  const grammarIds = uniqueLessonEntryLinks
    .filter((entry) => entry.entryType === "grammar")
    .map((entry) => entry.entryId);
  const [terms, grammar, studySignals, cards] = await Promise.all([
    getGlossaryEntriesByIds(input.database, "term", termIds),
    getGlossaryEntriesByIds(input.database, "grammar", grammarIds),
    listEntryStudySignals(
      input.database,
      uniqueLessonEntryLinks.map((entry) => ({
        entryId: entry.entryId,
        entryType: entry.entryType
      }))
    ),
    getCardsByIds(input.database, input.imageCardIds)
  ]);
  const [termCrossMediaCounts, grammarCrossMediaCounts] = await Promise.all([
    getCrossMediaSiblingCounts(
      input.database,
      "term",
      terms.map((entry) => entry.id)
    ),
    getCrossMediaSiblingCounts(
      input.database,
      "grammar",
      grammar.map((entry) => entry.id)
    )
  ]);
  const termMap = new Map(terms.map((entry) => [entry.id, entry]));
  const grammarMap = new Map(grammar.map((entry) => [entry.id, entry]));
  const studySignalsByEntry = buildStudySignalMap(studySignals);
  const subjectLookup =
    cards.length > 0
      ? await loadReviewSubjectStateLookup({
          cards,
          database: input.database,
          grammar,
          terms
        })
      : { subjectGroups: [] };
  const subjectStateByCardId = new Map(
    subjectLookup.subjectGroups.flatMap((group) =>
      group.cards.map((card) => [card.id, group.subjectState] as const)
    )
  );

  const baseEntries = uniqueLessonEntryLinks.flatMap((link) => {
    if (link.entryType === "term") {
      const entry = termMap.get(link.entryId);

      if (!entry) {
        return [];
      }

      return [
        mapTooltipEntry({
          crossMediaSiblingCount: termCrossMediaCounts.get(entry.id) ?? 0,
          entry,
          kind: "term",
          mediaSlug: input.mediaSlug,
          studySignals:
            studySignalsByEntry.get(buildEntryKey("term", entry.id)) ?? []
        })
      ];
    }

    const entry = grammarMap.get(link.entryId);

    if (!entry) {
      return [];
    }

    return [
      mapTooltipEntry({
        crossMediaSiblingCount: grammarCrossMediaCounts.get(entry.id) ?? 0,
        entry,
        kind: "grammar",
        mediaSlug: input.mediaSlug,
        studySignals:
          studySignalsByEntry.get(buildEntryKey("grammar", entry.id)) ?? []
      })
    ];
  });

  const cardEntries = cards.map((card) =>
    mapCardTooltipEntry(
      card,
      input.mediaSlug,
      subjectStateByCardId.get(card.id) ?? null
    )
  );

  return [...baseEntries, ...cardEntries];
}

function dedupeLessonEntryLinks(
  links: Awaited<ReturnType<typeof listLessonEntryLinks>>
) {
  const seen = new Set<string>();

  return links.filter((link) => {
    const key = buildEntryKey(link.entryType, link.entryId);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildStudySignalMap(rows: StudySignalRow[]) {
  const map = new Map<string, StudySignalRow[]>();

  for (const row of rows) {
    const key = buildEntryKey(row.entryType, row.entryId);
    const existing = map.get(key);

    if (existing) {
      existing.push(row);
      continue;
    }

    map.set(key, [row]);
  }

  return map;
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

function mapTooltipEntry(input: {
  crossMediaSiblingCount: number;
  entry: GrammarGlossaryEntry | TermGlossaryEntry;
  kind: "grammar" | "term";
  mediaSlug: string;
  studySignals: StudySignalRow[];
}): TextbookEntryTooltip {
  const baseEntry = {
    id: input.entry.sourceId,
    crossMediaHint:
      input.crossMediaSiblingCount > 0
        ? {
            otherMediaCount: input.crossMediaSiblingCount
          }
        : undefined,
    kind: input.kind,
    meaning: input.entry.meaningIt,
    notes: input.entry.notesIt ?? undefined,
    levelHint: input.entry.levelHint ?? undefined,
    statusLabel: resolveEntryStudyStateLabel(input.studySignals),
    segmentTitle: input.entry.segment?.title ?? undefined,
    glossaryHref: mediaGlossaryEntryHref(
      input.mediaSlug,
      input.kind,
      input.entry.sourceId
    )
  };

  if (input.kind === "term") {
    const entry = input.entry as TermGlossaryEntry;

    return {
      ...baseEntry,
      label: entry.lemma,
      reading: entry.reading,
      romaji: entry.romaji,
      literalMeaning: entry.meaningLiteralIt ?? undefined,
      pos: entry.pos ?? undefined,
      pronunciation:
        buildPronunciationData(input.mediaSlug, {
          ...entry,
          reading: entry.reading
        }) ?? undefined
    };
  }

  const entry = input.entry as GrammarGlossaryEntry;

  return {
    ...baseEntry,
    label: entry.pattern,
    title: entry.title,
    reading: entry.reading ?? undefined,
    pronunciation:
      buildPronunciationData(input.mediaSlug, {
        ...entry,
        reading: entry.reading ?? entry.pattern
      }) ?? undefined
  };
}

function mapCardTooltipEntry(
  card: CardListItem,
  mediaSlug: string,
  subjectState: {
    manualOverride: boolean;
    state: string;
    suspended: boolean;
  } | null
): TextbookCardTooltip {
  return {
    id: card.id,
    kind: "card",
    label: card.front,
    reading: undefined,
    meaning: card.back,
    notes: card.notesIt ?? undefined,
    typeLabel: card.cardType,
    statusLabel:
      card.status === "suspended" || subjectState?.suspended
        ? "Sospesa"
        : subjectState?.state === "known_manual" || subjectState?.manualOverride
          ? "Nota"
          : subjectState?.state
            ? "In review"
            : "Disponibile",
    segmentTitle: card.segment?.title ?? undefined,
    reviewHref: mediaReviewCardHref(mediaSlug, card.id)
  };
}

function resolveEntryStudyStateLabel(studySignals: StudySignalRow[]) {
  return deriveEntryStudyState(studySignals).label;
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

function collectLessonImageCardIds(astJson: string | null) {
  const lessonAst = parseLessonAst(astJson);
  return lessonAst ? collectImageCardIds(lessonAst) : [];
}

function markDataAsLive() {
  try {
    noStore();
  } catch {
    // Tests can execute these helpers outside a request.
  }
}
