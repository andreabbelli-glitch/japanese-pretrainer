import type { Route } from "next";

import {
  listGlossaryProgressSummaries,
  listGlossaryPreviewEntries,
  type DatabaseClient,
  type LessonListItem
} from "@/db";
import { mediaGlossaryEntryHref } from "@/lib/site";
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

type GlossaryProgressMediaTarget = {
  id: string;
  slug: string;
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

export async function loadGlossaryProgressSnapshot(
  database: DatabaseClient,
  mediaId: string,
  mediaSlug: string
) {
  const snapshots = await loadGlossaryProgressSnapshots(database, [
    {
      id: mediaId,
      slug: mediaSlug
    }
  ]);

  return (
    snapshots.get(mediaId) ??
    buildEmptyGlossaryProgressSnapshot()
  );
}

const STUDY_STATE_LABELS: Record<string, string> = {
  known: "Già nota",
  learning: "In studio",
  review: "In review",
  new: "Nuova",
  available: "Disponibile"
};

export async function loadGlossaryProgressSnapshots(
  database: DatabaseClient,
  media: GlossaryProgressMediaTarget[]
) {
  if (media.length === 0) {
    return new Map<string, GlossaryProgressSnapshot>();
  }

  const mediaIds = media.map((item) => item.id);
  const [summaries, previews] = await Promise.all([
    listGlossaryProgressSummaries(database, mediaIds),
    listGlossaryPreviewEntries(database, mediaIds, 6)
  ]);

  const snapshots = new Map<string, GlossaryProgressSnapshot>();
  const previewsByMedia = new Map<string, StudyEntryPreview[]>();

  for (const preview of previews) {
    const existing = previewsByMedia.get(preview.mediaId) ?? [];
    
    existing.push({
      href: mediaGlossaryEntryHref(preview.mediaSlug, preview.kind, preview.sourceId),
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

  for (const summary of summaries) {
    snapshots.set(summary.mediaId, {
      entriesCovered: summary.entriesCovered,
      entriesTotal: summary.entriesTotal,
      progressPercent: calculatePercent(summary.entriesCovered, summary.entriesTotal),
      previewEntries: previewsByMedia.get(summary.mediaId) ?? [],
      breakdown: {
        available: summary.available,
        known: summary.known,
        learning: summary.learning,
        new: summary.new,
        review: summary.review
      }
    });
  }

  return snapshots;
}

export function mapLessonTarget(
  lesson: LessonListItem | null
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

export function buildLessonMetrics(lessons: LessonListItem[]) {
  let lessonsCompleted = 0;
  let activeLessonRaw: LessonListItem | null = null;
  let nextLessonRaw: LessonListItem | null = null;
  let lastOpenedLessonRaw: LessonListItem | null = null;

  const groups = new Map<string, SegmentStudyPreview>();

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i]!;
    const status = lesson.progress?.status;
    const isCompleted = status === "completed";
    const isInProgress = status === "in_progress";

    if (isCompleted) {
      lessonsCompleted++;
    }

    if (isInProgress) {
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

      if (!existing.currentLessonTitle && currentLessonTitle) {
        existing.currentLessonTitle = currentLessonTitle;
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
    }
  }

  const activeLesson = mapLessonTarget(activeLessonRaw);
  const nextLesson = mapLessonTarget(nextLessonRaw ?? lessons.at(0) ?? null);

  return {
    activeLesson,
    lastOpenedLesson: mapLessonTarget(lastOpenedLessonRaw),
    lessonsCompleted,
    lessonsTotal: lessons.length,
    nextLesson,
    resumeLesson: nextLesson,
    segments: [...groups.values()]
  };
}
