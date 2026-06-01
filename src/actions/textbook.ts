"use server";

import {
  invalidateFuriganaModeChanged
} from "@/features/cache/server";
import {
  recordLessonOpened,
  setFuriganaMode,
  setLessonCompletionForAction
} from "@/features/textbook/server";
import type { FuriganaMode } from "@/features/textbook/types";

export async function setFuriganaModeAction(input: {
  mediaSlug: string;
  lessonSlug?: string;
  mode: FuriganaMode;
}) {
  await setFuriganaMode(input.mode);

  invalidateFuriganaModeChanged();

  return {
    ok: true as const,
    mode: input.mode
  };
}

export async function setLessonCompletionAction(input: {
  lessonId: string;
  mediaSlug: string;
  lessonSlug: string;
  completed: boolean;
}) {
  return setLessonCompletionForAction(input);
}

export async function recordLessonOpenedAction(input: { lessonId: string }) {
  const openedState = await recordLessonOpened(input.lessonId);

  return {
    ok: true as const,
    ...openedState
  };
}
