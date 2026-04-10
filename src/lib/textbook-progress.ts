import { eq } from "drizzle-orm";

import { db, lessonProgress, type DatabaseClient } from "@/db";
import {
  updateStudySettings,
  type FuriganaMode
} from "@/lib/settings";
import { formatLessonProgressStatusLabel } from "@/lib/study-format";
import type {
  TextbookLessonData,
  TextbookLessonNavItem
} from "@/lib/textbook";

type LessonOpenState = {
  lastOpenedAt: string;
  startedAt: string;
  status: "in_progress" | "completed";
};

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

export async function settleLessonOpenedStateForRender(
  data: TextbookLessonData,
  openedState: Promise<LessonOpenState>,
  onError: (error: unknown) => void = defaultLessonOpenRenderErrorHandler
) {
  try {
    const state = await openedState;
    return applyLessonOpenedState(data, state);
  } catch (error) {
    onError(error);
    return data;
  }
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
  const currentLessonItem =
    data.lessons.find((lesson) => lesson.id === data.lesson.id) ?? null;
  const hasStatusChange = data.lesson.status !== openedState.status;
  const hasLastOpenedAtChange =
    currentLessonItem?.lastOpenedAt !== openedState.lastOpenedAt;

  if (!hasStatusChange && !hasLastOpenedAtChange) {
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
  const activeLesson =
    lessons.find((lesson) => lesson.id === data.lesson.id) ?? data.activeLesson;
  const resumeLesson = data.resumeLesson
    ? updateLessonNavItem(data.resumeLesson)
    : null;
  const groups = data.groups.map((group) => ({
    ...group,
    lessons: group.lessons.map(updateLessonNavItem)
  }));

  return {
    ...data,
    activeLesson,
    groups,
    lesson: {
      ...data.lesson,
      status: nextStatus,
      statusLabel: nextStatusLabel
    },
    lessons,
    resumeLesson
  };
}

function defaultLessonOpenRenderErrorHandler(error: unknown) {
  console.error("Unable to record textbook lesson open.", error);
}
