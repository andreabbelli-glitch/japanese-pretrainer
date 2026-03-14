"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db, listMedia } from "@/db";
import { buildHrefWithSearch } from "@/lib/site";
import { mediaHref, mediaStudyHref } from "@/lib/site";
import {
  normalizeFuriganaMode,
  normalizeGlossaryDefaultSort,
  normalizeReviewDailyLimit,
  updateStudySettings
} from "@/lib/settings";

export async function saveStudySettingsAction(formData: FormData) {
  const returnTo = readOptionalInternalHref(formData, "returnTo");

  await updateStudySettings({
    furiganaMode: normalizeFuriganaMode(
      readRequiredString(formData, "furiganaMode")
    ),
    glossaryDefaultSort: normalizeGlossaryDefaultSort(
      readRequiredString(formData, "glossaryDefaultSort")
    ),
    reviewDailyLimit: normalizeReviewDailyLimit(
      Number.parseInt(readRequiredString(formData, "reviewDailyLimit"), 10)
    )
  });

  await revalidateSettingsConsumers();

  redirect(
    buildHrefWithSearch("/settings", (params) => {
      params.set("saved", "1");

      if (returnTo) {
        params.set("returnTo", returnTo);
      }
    })
  );
}

async function revalidateSettingsConsumers() {
  revalidatePath("/");
  revalidatePath("/media");
  revalidatePath("/settings");

  const media = await listMedia(db);

  for (const item of media) {
    revalidatePath(mediaHref(item.slug));
    revalidatePath(mediaStudyHref(item.slug, "textbook"), "layout");
    revalidatePath(mediaStudyHref(item.slug, "review"));
    revalidatePath(mediaStudyHref(item.slug, "progress"));
  }

  revalidatePath("/glossary");
}

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing form field: ${key}`);
  }

  return value.trim();
}

function readOptionalInternalHref(
  formData: FormData,
  key: string
): Route | null {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  return trimmed as Route;
}
