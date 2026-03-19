"use server";

import { revalidatePath } from "next/cache";

import { db, getMediaBySlug } from "@/db";
import {
  revalidateReviewSummaryCache,
  revalidateSettingsCache
} from "@/lib/data-cache";
import { setFuriganaMode, setLessonCompletionState } from "@/lib/textbook";
import type { FuriganaMode } from "@/lib/settings";
import { mediaHref, mediaStudyHref } from "@/lib/site";

export async function setFuriganaModeAction(input: {
  mediaSlug: string;
  lessonSlug?: string;
  mode: FuriganaMode;
}) {
  await setFuriganaMode(input.mode);

  revalidateSettingsCache();
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath(mediaHref(input.mediaSlug));
  revalidatePath(mediaStudyHref(input.mediaSlug, "textbook"));

  if (input.lessonSlug) {
    revalidatePath(
      `${mediaStudyHref(input.mediaSlug, "textbook")}/${input.lessonSlug}`
    );
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
  revalidateReviewSummaryCache(await readMediaId(input.mediaSlug));

  revalidatePath("/");
  revalidatePath("/media");
  revalidatePath("/review");
  revalidatePath(mediaHref(input.mediaSlug));
  revalidatePath(mediaStudyHref(input.mediaSlug, "progress"));
  revalidatePath(mediaStudyHref(input.mediaSlug, "review"));
  revalidatePath(mediaStudyHref(input.mediaSlug, "textbook"));
  revalidatePath(
    `${mediaStudyHref(input.mediaSlug, "textbook")}/${input.lessonSlug}`
  );

  return {
    ok: true as const,
    status: input.completed ? "completed" : "in_progress"
  };
}

async function readMediaId(mediaSlug: string) {
  const media = await getMediaBySlug(db, mediaSlug);

  return media?.id;
}
