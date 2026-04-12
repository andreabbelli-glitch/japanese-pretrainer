import { pickBestBy } from "@/lib/collections";
import {
  calculatePercent,
  compareIsoDates,
  formatLessonProgressStatusLabel
} from "@/lib/study-format";
import type {
  TextbookLessonData,
  TextbookLessonNavItem
} from "@/lib/textbook-types";

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
