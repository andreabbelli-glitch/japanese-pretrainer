"use server";

import {
  invalidateFuriganaModeChanged,
  invalidateLessonCompletionChanged
} from "@/lib/cache-invalidation-policy";
import { db } from "@/db";
import { getMediaBySlug } from "@/db/queries";
import { setFuriganaMode } from "@/features/textbook/server";
import { setLessonCompletionWithConsolidation } from "@/features/consolidation/server";
import { consolidationLessonHref } from "@/lib/site";
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

  const completion = await setLessonCompletionWithConsolidation({
    completed: input.completed,
    lessonId: input.lessonId
  });
  const media = await mediaPromise;

  invalidateLessonCompletionChanged({
    mediaId: media?.id
  });

  return {
    consolidationHref:
      input.completed && completion.consolidation.createdCount > 0
        ? consolidationLessonHref(input.mediaSlug, input.lessonSlug)
        : null,
    ok: true as const,
    status: input.completed ? "completed" : "in_progress"
  };
}
