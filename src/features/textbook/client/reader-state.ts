import { pickBestBy } from "@/features/shared/model/collections";
import {
  calculatePercent,
  compareIsoDates,
  formatLessonProgressStatusLabel
} from "@/features/study/model/format";
import type {
  TextbookLessonData,
  TextbookLessonNavItem
} from "@/features/textbook/types";

export const LESSON_OPEN_WRITE_THROTTLE_MS = 10 * 60 * 1000;

export type LessonOpenState = {
  lastOpenedAt: string;
  startedAt: string;
  status: "in_progress" | "completed";
};

export function applyLessonCompletionState(
  data: TextbookLessonData,
  completed: boolean
): TextbookLessonData {
  const currentLessonItem =
    data.lessons.find((lesson) => lesson.id === data.lesson.id) ?? null;
  const previousStatus = currentLessonItem?.status ?? data.lesson.status;

  if (!completed && previousStatus === "not_started") {
    return data;
  }

  const nextStatus: TextbookLessonNavItem["status"] = completed
    ? "completed"
    : "in_progress";

  if (previousStatus === nextStatus) {
    return data;
  }

  const completionDelta =
    Number(nextStatus === "completed") - Number(previousStatus === "completed");
  const nextStatusLabel = formatLessonProgressStatusLabel(nextStatus);
  const nextCompletedLessons = data.completedLessons + completionDelta;
  const nextCompletedAt = completed
    ? (currentLessonItem?.completedAt ?? data.lesson.completedAt ?? null)
    : null;
  const updateLessonNavItem = (lesson: TextbookLessonNavItem) =>
    lesson.id === data.lesson.id
      ? {
          ...lesson,
          completedAt: nextCompletedAt,
          status: nextStatus,
          statusLabel: nextStatusLabel
        }
      : lesson;
  const lessons = data.lessons.map(updateLessonNavItem);
  const groups = data.groups.map((group) => {
    const hasCurrentLesson = group.lessons.some(
      (lesson) => lesson.id === data.lesson.id
    );

    return hasCurrentLesson
      ? {
          ...group,
          completedLessons: group.completedLessons + completionDelta,
          lessons: group.lessons.map(updateLessonNavItem)
        }
      : group;
  });

  return {
    ...data,
    activeLesson: selectActiveLesson(lessons),
    completedLessons: nextCompletedLessons,
    groups,
    lesson: {
      ...data.lesson,
      completedAt: nextCompletedAt,
      status: nextStatus,
      statusLabel: nextStatusLabel
    },
    lessons,
    resumeLesson: selectResumeLesson(lessons),
    textbookProgressPercent: calculatePercent(
      nextCompletedLessons,
      data.totalLessons
    )
  };
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
  const previousStatus = currentLessonItem?.status ?? data.lesson.status;
  const completionDelta =
    Number(nextStatus === "completed") - Number(previousStatus === "completed");
  const nextCompletedLessons = Math.max(
    0,
    Math.min(data.totalLessons, data.completedLessons + completionDelta)
  );
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
    hasStatusChange
      ? selectActiveLesson(lessons)
      : updatedLesson && nextStatus === "in_progress"
        ? updatedLesson
        : data.activeLesson;
  const resumeLesson =
    hasStatusChange
      ? selectResumeLesson(lessons)
      : updatedLesson && data.resumeLesson?.id === updatedLesson.id
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
                completedLessons: Math.max(
                  0,
                  Math.min(
                    group.totalLessons,
                    group.completedLessons + completionDelta
                  )
                ),
                lessons: group.lessons.map((lesson) =>
                  lesson.id === updatedLesson.id ? updatedLesson : lesson
                )
              }
        );

  return {
    ...data,
    activeLesson,
    completedLessons: nextCompletedLessons,
    groups,
    lesson: {
      ...data.lesson,
      status: nextStatus,
      statusLabel: nextStatusLabel
    },
    lessons,
    resumeLesson,
    textbookProgressPercent: calculatePercent(
      nextCompletedLessons,
      data.totalLessons
    )
  };
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
