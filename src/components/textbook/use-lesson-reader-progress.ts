"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  recordLessonOpenedAction,
  setLessonCompletionAction
} from "@/actions/textbook";
import {
  applyLessonCompletionState,
  applyLessonOpenedState,
  LESSON_OPEN_WRITE_THROTTLE_MS,
  type LessonOpenState
} from "@/features/textbook/client/reader-state";
import type { TextbookLessonData } from "@/features/textbook/types";

type LessonOpenAttempt = {
  attemptedAt: number;
  promise: Promise<LessonOpenState> | null;
  state: LessonOpenState | null;
};

type LessonOpenRetryTimer = {
  lessonId: string;
  timeoutId: number;
};

const LESSON_OPEN_RETRY_DELAY_MS = 30_000;
const LESSON_OPEN_MAX_CALLS_PER_FAILURE_CYCLE = 2;

function isLessonOpenAttemptWithinThrottle(
  attempt: LessonOpenAttempt,
  now: number
) {
  if (attempt.state) {
    const lastOpenedAt = Date.parse(attempt.state.lastOpenedAt);

    if (Number.isFinite(lastOpenedAt)) {
      return now - lastOpenedAt < LESSON_OPEN_WRITE_THROTTLE_MS;
    }
  }

  return now - attempt.attemptedAt < LESSON_OPEN_WRITE_THROTTLE_MS;
}

export function useLessonReaderProgress(data: TextbookLessonData) {
  const router = useRouter();
  const [readerData, setReaderData] = useState(data);
  const [lastReceivedData, setLastReceivedData] = useState(data);
  const [lessonOpenRetryToken, setLessonOpenRetryToken] = useState(0);
  const [isSavingLesson, startSavingLesson] = useTransition();
  const currentLessonIdRef = useRef(data.lesson.id);
  const isMountedRef = useRef(false);
  const lessonOpenAttemptByIdRef = useRef(new Map<string, LessonOpenAttempt>());
  const lessonOpenAttemptCountByIdRef = useRef(new Map<string, number>());
  const lessonOpenRetryTimerRef = useRef<LessonOpenRetryTimer | null>(null);

  if (lastReceivedData !== data) {
    setLastReceivedData(data);
    setReaderData(data);
  }

  const cancelLessonOpenRetry = useCallback((lessonId?: string) => {
    const retryTimer = lessonOpenRetryTimerRef.current;

    if (!retryTimer || (lessonId && retryTimer.lessonId !== lessonId)) {
      return;
    }

    window.clearTimeout(retryTimer.timeoutId);
    lessonOpenRetryTimerRef.current = null;
  }, []);

  useEffect(() => {
    if (currentLessonIdRef.current === data.lesson.id) {
      return;
    }

    const previousLessonId = currentLessonIdRef.current;

    cancelLessonOpenRetry(previousLessonId);
    lessonOpenAttemptCountByIdRef.current.delete(previousLessonId);
    currentLessonIdRef.current = data.lesson.id;
  }, [cancelLessonOpenRetry, data.lesson.id]);

  const applyOpenedStateIfCurrent = useCallback(
    (
      lessonId: string,
      lessonStatusAtRequestStart: TextbookLessonData["lesson"]["status"],
      openedState: LessonOpenState
    ) => {
      setReaderData((current) => {
        if (
          current.lesson.id !== lessonId ||
          current.lesson.status !== lessonStatusAtRequestStart ||
          (current.lesson.status === "completed" &&
            openedState.status !== "completed")
        ) {
          return current;
        }

        return applyLessonOpenedState(current, openedState);
      });
    },
    []
  );

  const scheduleLessonOpenRetry = useCallback((lessonId: string) => {
    if (!isMountedRef.current || currentLessonIdRef.current !== lessonId) {
      return;
    }

    const actionCallCount =
      lessonOpenAttemptCountByIdRef.current.get(lessonId) ?? 0;

    if (actionCallCount >= LESSON_OPEN_MAX_CALLS_PER_FAILURE_CYCLE) {
      return;
    }

    const currentRetryTimer = lessonOpenRetryTimerRef.current;

    if (currentRetryTimer?.lessonId === lessonId) {
      return;
    }

    if (currentRetryTimer) {
      window.clearTimeout(currentRetryTimer.timeoutId);
    }

    const timeoutId = window.setTimeout(() => {
      if (lessonOpenRetryTimerRef.current?.timeoutId !== timeoutId) {
        return;
      }

      lessonOpenRetryTimerRef.current = null;

      if (!isMountedRef.current || currentLessonIdRef.current !== lessonId) {
        return;
      }

      setLessonOpenRetryToken((current) => current + 1);
    }, LESSON_OPEN_RETRY_DELAY_MS);

    lessonOpenRetryTimerRef.current = { lessonId, timeoutId };
  }, []);

  useEffect(() => {
    const lessonId = data.lesson.id;
    const lessonStatusAtRequestStart = data.lesson.status;
    const now = Date.now();
    const existingAttempt = lessonOpenAttemptByIdRef.current.get(lessonId);
    const isWithinThrottle =
      existingAttempt !== undefined &&
      isLessonOpenAttemptWithinThrottle(existingAttempt, now);

    if (isWithinThrottle && existingAttempt.state) {
      queueMicrotask(() => {
        applyOpenedStateIfCurrent(
          lessonId,
          lessonStatusAtRequestStart,
          existingAttempt.state!
        );
      });
      return;
    }

    let isCancelled = false;
    const attachOpenStateHandlers = (
      promise: Promise<LessonOpenState>,
      attemptedAt: number
    ) => {
      void promise
        .then((openedState) => {
          const currentAttempt = lessonOpenAttemptByIdRef.current.get(lessonId);

          if (currentAttempt?.promise === promise) {
            lessonOpenAttemptByIdRef.current.set(lessonId, {
              attemptedAt,
              promise: null,
              state: openedState
            });
            lessonOpenAttemptCountByIdRef.current.delete(lessonId);
            cancelLessonOpenRetry(lessonId);
          }

          if (!isCancelled) {
            applyOpenedStateIfCurrent(
              lessonId,
              lessonStatusAtRequestStart,
              openedState
            );
          }
        })
        .catch(() => {
          const currentAttempt = lessonOpenAttemptByIdRef.current.get(lessonId);

          if (currentAttempt?.promise !== promise) {
            return;
          }

          lessonOpenAttemptByIdRef.current.delete(lessonId);
          scheduleLessonOpenRetry(lessonId);
        });
    };

    if (isWithinThrottle && existingAttempt.promise) {
      if (!lessonOpenAttemptCountByIdRef.current.has(lessonId)) {
        lessonOpenAttemptCountByIdRef.current.set(lessonId, 1);
      }

      attachOpenStateHandlers(
        existingAttempt.promise,
        existingAttempt.attemptedAt
      );

      return () => {
        isCancelled = true;
      };
    }

    const actionCallCount =
      lessonOpenAttemptCountByIdRef.current.get(lessonId) ?? 0;
    const pendingRetry = lessonOpenRetryTimerRef.current;

    if (
      pendingRetry?.lessonId === lessonId ||
      actionCallCount >= LESSON_OPEN_MAX_CALLS_PER_FAILURE_CYCLE
    ) {
      return;
    }

    lessonOpenAttemptCountByIdRef.current.set(lessonId, actionCallCount + 1);

    const promise = recordLessonOpenedAction({ lessonId });

    lessonOpenAttemptByIdRef.current.set(lessonId, {
      attemptedAt: now,
      promise,
      state: null
    });
    attachOpenStateHandlers(promise, now);

    return () => {
      isCancelled = true;
    };
  }, [
    applyOpenedStateIfCurrent,
    cancelLessonOpenRetry,
    data,
    data.lesson.id,
    data.lesson.status,
    lessonOpenRetryToken,
    scheduleLessonOpenRetry
  ]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cancelLessonOpenRetry();
    };
  }, [cancelLessonOpenRetry]);

  const toggleLessonCompletion = useCallback(() => {
    const wasCompleted = readerData.lesson.status === "completed";
    const markAsCompleted = !wasCompleted;
    const lessonId = readerData.lesson.id;

    cancelLessonOpenRetry(lessonId);
    lessonOpenAttemptByIdRef.current.delete(lessonId);
    lessonOpenAttemptCountByIdRef.current.delete(lessonId);
    setReaderData((current) =>
      applyLessonCompletionState(current, markAsCompleted)
    );

    startSavingLesson(async () => {
      try {
        const result = await setLessonCompletionAction({
          lessonId: readerData.lesson.id,
          mediaSlug: readerData.media.slug,
          lessonSlug: readerData.lesson.slug,
          completed: markAsCompleted
        });

        if (markAsCompleted && result.consolidationHref) {
          router.push(result.consolidationHref);
        }
      } catch {
        lessonOpenAttemptByIdRef.current.delete(lessonId);
        lessonOpenAttemptCountByIdRef.current.delete(lessonId);
        setReaderData((current) =>
          applyLessonCompletionState(current, wasCompleted)
        );
      }
    });
  }, [cancelLessonOpenRetry, readerData, router]);

  return {
    isSavingLesson,
    readerData,
    toggleLessonCompletion
  };
}
