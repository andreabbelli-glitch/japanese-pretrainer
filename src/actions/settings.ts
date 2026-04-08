"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";

import { readRequiredString } from "./form-data.ts";
import { revalidateSettingsCache } from "@/lib/data-cache";
import { buildHrefWithSearch } from "@/lib/site";
import {
  normalizeFuriganaMode,
  normalizeGlossaryDefaultSort,
  normalizeKanjiClashDailyNewLimit,
  normalizeKanjiClashDefaultScope,
  normalizeKanjiClashManualDefaultSize,
  normalizeReviewFrontFurigana,
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
    kanjiClashDailyNewLimit: normalizeKanjiClashDailyNewLimit(
      Number.parseInt(readRequiredString(formData, "kanjiClashDailyNewLimit"), 10)
    ),
    kanjiClashDefaultScope: normalizeKanjiClashDefaultScope(
      readRequiredString(formData, "kanjiClashDefaultScope")
    ),
    kanjiClashManualDefaultSize: normalizeKanjiClashManualDefaultSize(
      Number.parseInt(
        readRequiredString(formData, "kanjiClashManualDefaultSize"),
        10
      )
    ),
    reviewFrontFurigana: normalizeReviewFrontFurigana(
      readRequiredString(formData, "reviewFrontFurigana")
    ),
    reviewDailyLimit: normalizeReviewDailyLimit(
      Number.parseInt(readRequiredString(formData, "reviewDailyLimit"), 10)
    )
  });

  revalidateSettingsCache();

  redirect(
    buildHrefWithSearch("/settings", (params) => {
      params.set("saved", "1");

      if (returnTo) {
        params.set("returnTo", returnTo);
      }
    })
  );
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
