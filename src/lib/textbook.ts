import type { Route } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { eq } from "drizzle-orm";

import {
  db,
  getGrammarEntriesByIds,
  getLessonBySlug,
  getMediaBySlug,
  getTermEntriesByIds,
  lessonProgress,
  listEntryStudySignals,
  listLessonEntryLinks,
  listLessonsByMediaId,
  type DatabaseClient,
  type GrammarGlossaryEntry,
  type LessonListItem,
  type TermGlossaryEntry
} from "@/db";
import { mediaGlossaryEntryHref, mediaStudyHref } from "@/lib/site";
import type { MarkdownDocument } from "@/lib/content/types";
import {
  getFuriganaModeSetting,
  updateStudySettings,
  type FuriganaMode
} from "@/lib/settings";
import { deriveEntryStudyState } from "@/lib/study-entry";
import {
  calculatePercent,
  compareIsoDates,
  formatLessonProgressStatusLabel,
  formatMediaTypeLabel,
  formatSegmentKindLabel
} from "@/lib/study-format";
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
  statusLabel: string;
  segmentTitle?: string;
  glossaryHref: Route;
};

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
    htmlRendered: string;
  };
  entries: TextbookEntryTooltip[];
  previousLesson: TextbookLessonNavItem | null;
  nextLesson: TextbookLessonNavItem | null;
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

  const [lessons, lesson, furiganaMode] = await Promise.all([
    listLessonsByMediaId(database, media.id),
    getLessonBySlug(database, media.id, lessonSlug),
    getFuriganaMode(database)
  ]);

  if (!lesson) {
    return null;
  }

  const indexModel = buildTextbookIndexModel({
    furiganaMode,
    lessons,
    media
  });
  const currentIndex = indexModel.lessons.findIndex(
    (item) => item.id === lesson.id
  );
  const lessonEntryLinks = await listLessonEntryLinks(database, lesson.id);
  const entries = await loadLessonTooltipEntries({
    database,
    lessonEntryLinks,
    mediaSlug
  });

  return {
    ...indexModel,
    lesson: {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      difficulty: lesson.difficulty,
      summary: lesson.summary,
      excerpt: lesson.content?.excerpt ?? null,
      status: normalizeLessonStatus(lesson.progress?.status ?? null),
      statusLabel: formatLessonProgressStatusLabel(lesson.progress?.status ?? null),
      segmentTitle: lesson.segment?.title ?? "Percorso principale",
      ast: parseLessonAst(lesson.content?.astJson ?? null),
      htmlRendered: lesson.content?.htmlRendered ?? ""
    },
    entries,
    previousLesson: currentIndex > 0 ? indexModel.lessons[currentIndex - 1] : null,
    nextLesson:
      currentIndex >= 0 && currentIndex < indexModel.lessons.length - 1
        ? indexModel.lessons[currentIndex + 1]
        : null
  };
}

export async function recordLessonOpened(
  lessonId: string,
  database: DatabaseClient = db
) {
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

    return;
  }

  await database
    .update(lessonProgress)
    .set({
      status: existing.status === "completed" ? "completed" : "in_progress",
      startedAt:
        existing.status === "not_started" || existing.startedAt === null
          ? nowIso
          : existing.startedAt,
      completedAt: existing.status === "completed" ? existing.completedAt : null,
      lastOpenedAt: nowIso
    })
    .where(eq(lessonProgress.lessonId, lessonId));
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
        `${input.media.title} è pronto per una lettura lunga, ordinata e contestuale.`,
      mediaTypeLabel: formatMediaTypeLabel(input.media.mediaType),
      segmentKindLabel: formatSegmentKindLabel(input.media.segmentKind)
    },
    furiganaMode: input.furiganaMode,
    lessons,
    groups: groupLessons(lessons, input.lessons),
    resumeLesson: selectResumeLesson(lessons),
    completedLessons,
    totalLessons: lessons.length,
    textbookProgressPercent: calculatePercent(completedLessons, lessons.length),
    glossaryHref: mediaStudyHref(input.media.slug, "glossary")
  };
}

async function loadLessonTooltipEntries(input: {
  database: DatabaseClient;
  lessonEntryLinks: Awaited<ReturnType<typeof listLessonEntryLinks>>;
  mediaSlug: string;
}) {
  const uniqueLessonEntryLinks = dedupeLessonEntryLinks(input.lessonEntryLinks);
  const termIds = uniqueLessonEntryLinks
    .filter((entry) => entry.entryType === "term")
    .map((entry) => entry.entryId);
  const grammarIds = uniqueLessonEntryLinks
    .filter((entry) => entry.entryType === "grammar")
    .map((entry) => entry.entryId);
  const [terms, grammar, studySignals] = await Promise.all([
    getTermEntriesByIds(input.database, termIds),
    getGrammarEntriesByIds(input.database, grammarIds),
    listEntryStudySignals(
      input.database,
      uniqueLessonEntryLinks.map((entry) => ({
        entryId: entry.entryId,
        entryType: entry.entryType
      }))
    )
  ]);
  const termMap = new Map(terms.map((entry) => [entry.id, entry]));
  const grammarMap = new Map(grammar.map((entry) => [entry.id, entry]));
  const studySignalsByEntry = buildStudySignalMap(studySignals);

  return uniqueLessonEntryLinks.flatMap((link) => {
    if (link.entryType === "term") {
      const entry = termMap.get(link.entryId);

      if (!entry) {
        return [];
      }

      return [
        mapTermTooltipEntry(entry, studySignalsByEntry.get(`term:${entry.id}`) ?? [], input.mediaSlug)
      ];
    }

    const entry = grammarMap.get(link.entryId);

    if (!entry) {
      return [];
    }

    return [
      mapGrammarTooltipEntry(
        entry,
        studySignalsByEntry.get(`grammar:${entry.id}`) ?? [],
        input.mediaSlug
      )
    ];
  });
}

function dedupeLessonEntryLinks(
  links: Awaited<ReturnType<typeof listLessonEntryLinks>>
) {
  const seen = new Set<string>();

  return links.filter((link) => {
    const key = `${link.entryType}:${link.entryId}`;

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
    const key = `${row.entryType}:${row.entryId}`;
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

function selectResumeLesson(lessons: TextbookLessonNavItem[]) {
  const inProgress = [...lessons]
    .filter((lesson) => lesson.status === "in_progress")
    .sort((left, right) => compareIsoDates(right.lastOpenedAt, left.lastOpenedAt));

  if (inProgress[0]) {
    return inProgress[0];
  }

  return lessons.find((lesson) => lesson.status !== "completed") ?? lessons[0] ?? null;
}

function mapTermTooltipEntry(
  entry: TermGlossaryEntry,
  studySignals: StudySignalRow[],
  mediaSlug: string
): TextbookEntryTooltip {
  return {
    id: entry.id,
    kind: "term",
    label: entry.lemma,
    reading: entry.reading,
    romaji: entry.romaji,
    meaning: entry.meaningIt,
    literalMeaning: entry.meaningLiteralIt ?? undefined,
    notes: entry.notesIt ?? undefined,
    pos: entry.pos ?? undefined,
    levelHint: entry.levelHint ?? undefined,
    statusLabel: resolveEntryStudyStateLabel(entry.status?.status ?? null, studySignals),
    segmentTitle: entry.segment?.title ?? undefined,
    glossaryHref: mediaGlossaryEntryHref(mediaSlug, "term", entry.id)
  };
}

function mapGrammarTooltipEntry(
  entry: GrammarGlossaryEntry,
  studySignals: StudySignalRow[],
  mediaSlug: string
): TextbookEntryTooltip {
  return {
    id: entry.id,
    kind: "grammar",
    label: entry.pattern,
    title: entry.title,
    meaning: entry.meaningIt,
    notes: entry.notesIt ?? undefined,
    levelHint: entry.levelHint ?? undefined,
    statusLabel: resolveEntryStudyStateLabel(entry.status?.status ?? null, studySignals),
    segmentTitle: entry.segment?.title ?? undefined,
    glossaryHref: mediaGlossaryEntryHref(mediaSlug, "grammar", entry.id)
  };
}

function resolveEntryStudyStateLabel(
  entryStatus: string | null,
  studySignals: StudySignalRow[]
) {
  return deriveEntryStudyState(entryStatus, studySignals).label;
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
