import type { AppHref } from "@/features/navigation";
import {
  compareIsoDates,
  formatLessonProgressStatusLabel
} from "@/features/study/model/format";

export type StudyEntryPreview = {
  id: string;
  kind: "term" | "grammar";
  label: string;
  reading?: string;
  meaning: string;
  statusLabel: string;
  segmentTitle?: string;
  href: AppHref;
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

export type LessonMetricsListItem = {
  id: string;
  slug: string;
  title: string;
  orderIndex: number;
  difficulty: string | null;
  summary: string | null;
  segment: {
    id: string;
    title: string;
    notes: string | null;
  } | null;
  progress: {
    status: "not_started" | "in_progress" | "completed" | string | null;
    completedAt: string | null;
    lastOpenedAt: string | null;
  } | null;
  content?: {
    excerpt: string | null;
  } | null;
};

export function buildEmptyGlossaryProgressSnapshot(): GlossaryProgressSnapshot {
  return {
    entriesCovered: 0,
    entriesTotal: 0,
    progressPercent: null,
    previewEntries: [],
    breakdown: {
      available: 0,
      known: 0,
      learning: 0,
      new: 0,
      review: 0
    }
  };
}

export function mapLessonTarget(
  lesson: LessonMetricsListItem | null
): LessonResumeTarget | null {
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
    statusLabel: formatLessonProgressStatusLabel(
      lesson.progress?.status ?? null
    ),
    segmentTitle: lesson.segment?.title
  };
}

export function buildLessonMetrics(lessons: LessonMetricsListItem[]) {
  let lessonsCompleted = 0;
  let inProgressLessons = 0;
  let activeLessonRaw: LessonMetricsListItem | null = null;
  let nextLessonRaw: LessonMetricsListItem | null = null;
  let lastOpenedLessonRaw: LessonMetricsListItem | null = null;

  const groups = new Map<string, SegmentStudyPreview>();
  const segmentCurrentLessonOpenedAt = new Map<string, string | null>();

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i]!;
    const status = lesson.progress?.status;
    const isCompleted = status === "completed";
    const isInProgress = status === "in_progress";

    if (isCompleted) {
      lessonsCompleted++;
    }

    if (isInProgress) {
      inProgressLessons++;

      if (
        !activeLessonRaw ||
        compareIsoDates(
          lesson.progress?.lastOpenedAt ?? null,
          activeLessonRaw.progress?.lastOpenedAt ?? null
        ) > 0
      ) {
        activeLessonRaw = lesson;
      }
    }

    if (lesson.progress?.lastOpenedAt) {
      if (
        !lastOpenedLessonRaw ||
        compareIsoDates(
          lesson.progress?.lastOpenedAt ?? null,
          lastOpenedLessonRaw.progress?.lastOpenedAt ?? null
        ) > 0
      ) {
        lastOpenedLessonRaw = lesson;
      }
    }

    if (!nextLessonRaw && !isCompleted) {
      nextLessonRaw = lesson;
    }

    const key = lesson.segment?.id ?? "__ungrouped__";
    const currentLessonTitle = isInProgress ? lesson.title : undefined;
    const existing = groups.get(key);

    if (existing) {
      existing.lessonCount += 1;
      existing.completedLessons += isCompleted ? 1 : 0;

      if (
        currentLessonTitle &&
        compareIsoDates(
          lesson.progress?.lastOpenedAt ?? null,
          segmentCurrentLessonOpenedAt.get(key) ?? null
        ) > 0
      ) {
        existing.currentLessonTitle = currentLessonTitle;
        segmentCurrentLessonOpenedAt.set(
          key,
          lesson.progress?.lastOpenedAt ?? null
        );
      }
    } else {
      groups.set(key, {
        id: key,
        title: lesson.segment?.title ?? "Percorso principale",
        note: lesson.segment?.notes ?? null,
        lessonCount: 1,
        completedLessons: isCompleted ? 1 : 0,
        currentLessonTitle
      });

      if (currentLessonTitle) {
        segmentCurrentLessonOpenedAt.set(
          key,
          lesson.progress?.lastOpenedAt ?? null
        );
      }
    }
  }

  const activeLesson = mapLessonTarget(activeLessonRaw);
  const nextLesson = mapLessonTarget(nextLessonRaw ?? lessons.at(0) ?? null);

  return {
    activeLesson,
    inProgressLessons,
    lastOpenedLesson: mapLessonTarget(lastOpenedLessonRaw),
    lessonsCompleted,
    lessonsTotal: lessons.length,
    nextLesson,
    resumeLesson: nextLesson,
    segments: [...groups.values()]
  };
}
