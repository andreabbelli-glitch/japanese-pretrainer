"use server";

import { revalidatePath } from "next/cache";

import {
  setFuriganaMode,
  setLessonCompletionState,
  type FuriganaMode
} from "@/lib/textbook";
import { mediaHref, mediaStudyHref } from "@/lib/site";

export async function setFuriganaModeAction(input: {
  mediaSlug: string;
  lessonSlug?: string;
  mode: FuriganaMode;
}) {
  await setFuriganaMode(input.mode);

  revalidatePath(mediaStudyHref(input.mediaSlug, "textbook"));

  if (input.lessonSlug) {
    revalidatePath(`${mediaStudyHref(input.mediaSlug, "textbook")}/${input.lessonSlug}`);
  }

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

  revalidatePath(mediaHref(input.mediaSlug));
  revalidatePath(mediaStudyHref(input.mediaSlug, "textbook"));
  revalidatePath(`${mediaStudyHref(input.mediaSlug, "textbook")}/${input.lessonSlug}`);

  return {
    ok: true as const,
    status: input.completed ? "completed" : "in_progress"
  };
}
