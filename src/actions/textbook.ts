"use server";

import {
  invalidateFuriganaModeChanged,
  invalidateLessonCompletionChanged
} from "@/lib/cache-invalidation-policy";
import { db } from "@/db";
import { getMediaBySlug } from "@/db/queries";
import {
  setFuriganaMode,
  setLessonCompletionState
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
  const mediaPromise = getMediaBySlug(db, input.mediaSlug);

  await setLessonCompletionState(input.lessonId, input.completed);
  const media = await mediaPromise;

  invalidateLessonCompletionChanged({
    mediaId: media?.id
  });

  return {
    ok: true as const,
    status: input.completed ? "completed" : "in_progress"
  };
}
