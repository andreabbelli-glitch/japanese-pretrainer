import type { Route } from "next";

import {
  listEntryStudySignals,
  listGrammarEntriesByMediaId,
  listTermEntriesByMediaId,
  type DatabaseClient,
  type GrammarGlossaryEntry,
  type LessonListItem,
  type TermGlossaryEntry
} from "@/db";
import { mediaGlossaryEntryHref } from "@/lib/site";
import { deriveEntryStudyState } from "@/lib/study-entry";
import {
  calculatePercent,
  compareIsoDates,
  formatLessonProgressStatusLabel
} from "@/lib/study-format";

export type StudyEntryPreview = {
  id: string;
  kind: "term" | "grammar";
  label: string;
  reading?: string;
  meaning: string;
  statusLabel: string;
  segmentTitle?: string;
  href: Route;
};

export type SegmentStudyPreview = {
  id: string;
  title: string;
  note?: string | null;
  lessonCount: number;
  completedLessons: number;
  currentLessonTitle?: string;
};

export type LessonResumeTarget = {
  slug: string;
  title: string;
  summary?: string | null;
  excerpt?: string | null;
  status: "not_started" | "in_progress" | "completed";
  statusLabel: string;
  segmentTitle?: string;
};

export type GlossaryProgressSnapshot = {
  entriesCovered: number;
  entriesTotal: number;
  progressPercent: number | null;
  previewEntries: StudyEntryPreview[];
  breakdown: {
    available: number;
    known: number;
    learning: number;
    new: number;
    review: number;
  };
};

type StudySignalRow = Awaited<ReturnType<typeof listEntryStudySignals>>[number];

export async function loadGlossaryProgressSnapshot(
  database: DatabaseClient,
  mediaId: string,
  mediaSlug: string
) {
  const [terms, grammar] = await Promise.all([
    listTermEntriesByMediaId(database, mediaId),
    listGrammarEntriesByMediaId(database, mediaId)
  ]);
  const studySignals = await listEntryStudySignals(
    database,
    [
      ...terms.map((entry) => ({
        entryId: entry.id,
        entryType: "term" as const
      })),
      ...grammar.map((entry) => ({
        entryId: entry.id,
        entryType: "grammar" as const
      }))
    ]
  );

  return buildGlossaryProgressSnapshot({
    grammar,
    mediaSlug,
    studySignals,
    terms
  });
}

export function buildGlossaryProgressSnapshot(input: {
  grammar: GrammarGlossaryEntry[];
  mediaSlug: string;
  studySignals: StudySignalRow[];
  terms: TermGlossaryEntry[];
}): GlossaryProgressSnapshot {
  const entries = [
    ...input.terms.map((entry) => ({
      entry,
      kind: "term" as const
    })),
    ...input.grammar.map((entry) => ({
      entry,
      kind: "grammar" as const
    }))
  ];
  const studySignalsByEntry = groupStudySignals(input.studySignals);
  const breakdown = {
    available: 0,
    known: 0,
    learning: 0,
    new: 0,
    review: 0
  };
  const previewEntries = entries.map(({ entry, kind }) => {
    const studyState = deriveEntryStudyState(
      entry.status?.status ?? null,
      (studySignalsByEntry.get(`${kind}:${entry.id}`) ?? []).map((signal) => ({
        manualOverride: signal.manualOverride,
        reviewState: signal.reviewState
      }))
    );

    breakdown[studyState.key] += 1;

    return {
      href: mediaGlossaryEntryHref(input.mediaSlug, kind, entry.id),
      id: entry.id,
      kind,
      label: kind === "term" ? entry.lemma : entry.pattern,
      meaning: entry.meaningIt,
      reading: kind === "term" ? entry.reading : undefined,
      segmentTitle: entry.segment?.title ?? undefined,
      statusLabel: studyState.label
    };
  });
  const entriesCovered = breakdown.known + breakdown.learning + breakdown.review;
  const entriesTotal = entries.length;

  return {
    entriesCovered,
    entriesTotal,
    progressPercent: calculatePercent(entriesCovered, entriesTotal),
    previewEntries: previewEntries.slice(0, 6),
    breakdown
  };
}

export function selectActiveLesson(lessons: LessonListItem[]): LessonResumeTarget | null {
  const inProgress = [...lessons]
    .filter((lesson) => lesson.progress?.status === "in_progress")
    .sort((left, right) =>
      compareIsoDates(
        right.progress?.lastOpenedAt ?? null,
        left.progress?.lastOpenedAt ?? null
      )
    );

  if (inProgress[0]) {
    return mapLessonTarget(inProgress[0]);
  }

  return null;
}

export function selectResumeLesson(lessons: LessonListItem[]): LessonResumeTarget | null {
  return selectNextLesson(lessons);
}

export function selectNextLesson(lessons: LessonListItem[]): LessonResumeTarget | null {
  const notCompleted = lessons.find(
    (lesson) => lesson.progress?.status !== "completed"
  );

  return mapLessonTarget(notCompleted ?? lessons.at(0) ?? null);
}

export function mapLessonTarget(lesson: LessonListItem | null): LessonResumeTarget | null {
  if (!lesson) {
    return null;
  }

  return {
    slug: lesson.slug,
    title: lesson.title,
    summary: lesson.summary,
    excerpt: lesson.content?.excerpt,
    status:
      lesson.progress?.status === "in_progress" ||
      lesson.progress?.status === "completed"
        ? lesson.progress.status
        : "not_started",
    statusLabel: formatLessonProgressStatusLabel(lesson.progress?.status ?? null),
    segmentTitle: lesson.segment?.title
  };
}

export function buildSegments(lessons: LessonListItem[]): SegmentStudyPreview[] {
  const groups = new Map<string, SegmentStudyPreview>();

  for (const lesson of lessons) {
    const key = lesson.segment?.id ?? "__ungrouped__";
    const currentLessonTitle =
      lesson.progress?.status === "in_progress" ? lesson.title : undefined;
    const existing = groups.get(key);

    if (existing) {
      existing.lessonCount += 1;
      existing.completedLessons += lesson.progress?.status === "completed" ? 1 : 0;

      if (!existing.currentLessonTitle && currentLessonTitle) {
        existing.currentLessonTitle = currentLessonTitle;
      }

      continue;
    }

    groups.set(key, {
      id: key,
      title: lesson.segment?.title ?? "Percorso principale",
      note: lesson.segment?.notes ?? null,
      lessonCount: 1,
      completedLessons: lesson.progress?.status === "completed" ? 1 : 0,
      currentLessonTitle
    });
  }

  return [...groups.values()];
}

function groupStudySignals(rows: StudySignalRow[]) {
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
