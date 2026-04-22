import { eq, sql } from "drizzle-orm";

import { db, lessonProgress, type DatabaseClient } from "@/db";
import { updateStudySettings, type FuriganaMode } from "@/lib/settings";
import { formatLessonProgressStatusLabel } from "@/lib/study-format";
import type {
  TextbookLessonData,
  TextbookLessonNavItem
} from "@/lib/textbook-types";

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
  const [updated] = await database
    .insert(lessonProgress)
    .values({
      lessonId,
      status: "in_progress",
      startedAt: nowIso,
      completedAt: null,
      lastOpenedAt: nowIso
    })
    .onConflictDoUpdate({
      target: lessonProgress.lessonId,
      set: {
        status: sql`case
          when ${lessonProgress.status} = 'completed'
            then ${lessonProgress.status}
          else 'in_progress'
        end`,
        startedAt: sql`case
          when ${lessonProgress.status} = 'not_started'
            or ${lessonProgress.startedAt} is null
            then excluded.started_at
          else ${lessonProgress.startedAt}
        end`,
        completedAt: sql`case
          when ${lessonProgress.status} = 'completed'
            then ${lessonProgress.completedAt}
          else null
        end`,
        lastOpenedAt: sql`excluded.last_opened_at`
      }
    })
    .returning({
      lastOpenedAt: lessonProgress.lastOpenedAt,
      startedAt: lessonProgress.startedAt,
      status: lessonProgress.status
    });

  return {
    lastOpenedAt: updated?.lastOpenedAt ?? nowIso,
    startedAt: updated?.startedAt ?? nowIso,
    status: updated?.status === "completed" ? "completed" : "in_progress"
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
    if (!completed) {
      return;
    }

    await database.insert(lessonProgress).values({
      lessonId,
      status: "completed",
      startedAt: nowIso,
      completedAt: nowIso,
      lastOpenedAt: nowIso
    });

    return;
  }

  if (!completed && existing.status === "not_started") {
    return;
  }

  await database
    .update(lessonProgress)
    .set({
      status: completed ? "completed" : "in_progress",
      startedAt:
        completed || existing.status !== "not_started"
          ? (existing.startedAt ?? nowIso)
          : null,
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
  const currentLessonIndex = data.lessons.findIndex(
    (lesson) => lesson.id === data.lesson.id
  );
  const currentLessonItem =
    currentLessonIndex >= 0 ? data.lessons[currentLessonIndex]! : null;
  const hasStatusChange = data.lesson.status !== openedState.status;
  const hasLastOpenedAtChange =
    currentLessonItem?.lastOpenedAt !== openedState.lastOpenedAt;

  if (!hasStatusChange && !hasLastOpenedAtChange) {
    return data;
  }

  const nextStatus = openedState.status;
  const nextStatusLabel = formatLessonProgressStatusLabel(nextStatus);
  const updatedLesson =
    currentLessonItem === null
      ? null
      : ({
          ...currentLessonItem,
          lastOpenedAt: openedState.lastOpenedAt,
          status: nextStatus,
          statusLabel: nextStatusLabel
        } satisfies TextbookLessonNavItem);
  const lessons =
    updatedLesson === null
      ? data.lessons
      : data.lessons.map((lesson, index) =>
          index === currentLessonIndex ? updatedLesson : lesson
        );
  const activeLesson =
    updatedLesson && nextStatus === "in_progress"
      ? updatedLesson
      : data.activeLesson;
  const resumeLesson =
    updatedLesson && data.resumeLesson?.id === updatedLesson.id
      ? updatedLesson
      : data.resumeLesson;
  const groups =
    !hasStatusChange || updatedLesson === null
      ? data.groups
      : data.groups.map((group) =>
          group.id !== (updatedLesson.segmentId ?? "__ungrouped__")
            ? group
            : {
                ...group,
                lessons: group.lessons.map((lesson) =>
                  lesson.id === updatedLesson.id ? updatedLesson : lesson
                )
              }
        );

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
