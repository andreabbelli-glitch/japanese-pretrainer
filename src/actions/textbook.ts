"use server";

import {
  updateMediaListCache,
  updateReviewSummaryCache,
  updateSettingsCache
} from "@/lib/data-cache";
import { db, getMediaBySlug } from "@/db";
import { setFuriganaMode, setLessonCompletionState } from "@/lib/textbook";
import type { FuriganaMode } from "@/lib/settings";

export async function setFuriganaModeAction(input: {
  mediaSlug: string;
  lessonSlug?: string;
  mode: FuriganaMode;
}) {
  await setFuriganaMode(input.mode);

  updateSettingsCache();

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

  updateMediaListCache();
  updateReviewSummaryCache(media?.id);

  return {
    ok: true as const,
    status: input.completed ? "completed" : "in_progress"
  };
}
