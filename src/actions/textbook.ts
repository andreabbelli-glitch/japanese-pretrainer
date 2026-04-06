"use server";

import {
  revalidateMediaListCache,
  revalidateReviewSummaryCache,
  revalidateSettingsCache
} from "@/lib/data-cache";
import { setFuriganaMode, setLessonCompletionState } from "@/lib/textbook";
import type { FuriganaMode } from "@/lib/settings";

export async function setFuriganaModeAction(input: {
  mediaSlug: string;
  lessonSlug?: string;
  mode: FuriganaMode;
}) {
  await setFuriganaMode(input.mode);

  revalidateSettingsCache();

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
  await setLessonCompletionState(input.lessonId, input.completed);
  revalidateMediaListCache();
  revalidateReviewSummaryCache();

  return {
    ok: true as const,
    status: input.completed ? "completed" : "in_progress"
  };
}
