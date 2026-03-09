"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db, listMedia } from "@/db";
import { mediaHref, mediaStudyHref } from "@/lib/site";
import {
  normalizeFuriganaMode,
  normalizeGlossaryDefaultSort,
  normalizeReviewDailyLimit,
  updateStudySettings
} from "@/lib/settings";

export async function saveStudySettingsAction(formData: FormData) {
  await updateStudySettings({
    furiganaMode: normalizeFuriganaMode(readRequiredString(formData, "furiganaMode")),
    glossaryDefaultSort: normalizeGlossaryDefaultSort(
      readRequiredString(formData, "glossaryDefaultSort")
    ),
    reviewDailyLimit: normalizeReviewDailyLimit(
      Number.parseInt(readRequiredString(formData, "reviewDailyLimit"), 10)
    )
  });

  await revalidateSettingsConsumers();

  redirect("/settings?saved=1");
}

async function revalidateSettingsConsumers() {
  revalidatePath("/");
  revalidatePath("/media");
  revalidatePath("/settings");

  const media = await listMedia(db);

  for (const item of media) {
    revalidatePath(mediaHref(item.slug));
    revalidatePath(mediaStudyHref(item.slug, "textbook"), "layout");
    revalidatePath(mediaStudyHref(item.slug, "glossary"));
    revalidatePath(mediaStudyHref(item.slug, "review"));
    revalidatePath(mediaStudyHref(item.slug, "progress"));
  }
}

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing form field: ${key}`);
  }

  return value.trim();
}
