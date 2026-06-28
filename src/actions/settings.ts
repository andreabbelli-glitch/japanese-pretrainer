"use server";

import { redirect } from "next/navigation";

import { readOptionalInternalHref, readRequiredString } from "./form-data.ts";
import {
  invalidateReviewMutationCaches,
  invalidateStudySettingsSaved
} from "@/features/cache/server";
import { applyFsrsReschedule } from "@/features/fsrs-optimizer/server";
import { buildHrefWithSearch } from "@/features/navigation";
import {
  normalizeFuriganaMode,
  normalizeGlossaryDefaultSort,
  normalizeKanjiClashDailyNewLimit,
  normalizeKanjiClashDefaultScope,
  normalizeKanjiClashManualDefaultSize,
  normalizeReviewAutoplayAudioOnReveal,
  normalizeReviewFrontFurigana,
  normalizeReviewDailyLimit,
  updateStudySettings
} from "@/features/settings/server";

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
      readRequiredInteger(formData, "kanjiClashDailyNewLimit")
    ),
    kanjiClashDefaultScope: normalizeKanjiClashDefaultScope(
      readRequiredString(formData, "kanjiClashDefaultScope")
    ),
    kanjiClashManualDefaultSize: normalizeKanjiClashManualDefaultSize(
      readRequiredInteger(formData, "kanjiClashManualDefaultSize")
    ),
    reviewAutoplayAudioOnReveal: normalizeReviewAutoplayAudioOnReveal(
      readRequiredString(formData, "reviewAutoplayAudioOnReveal")
    ),
    reviewFrontFurigana: normalizeReviewFrontFurigana(
      readRequiredString(formData, "reviewFrontFurigana")
    ),
    reviewDailyLimit: normalizeReviewDailyLimit(
      readRequiredInteger(formData, "reviewDailyLimit")
    )
  });

  invalidateStudySettingsSaved();

  redirect(
    buildHrefWithSearch("/settings", (params) => {
      params.set("saved", "1");

      if (returnTo) {
        params.set("returnTo", returnTo);
      }
    })
  );
}

export async function applyFsrsRescheduleAction(formData: FormData) {
  const returnTo = readOptionalInternalHref(formData, "returnTo");
  const result = await applyFsrsReschedule({
    expectedFsrsCacheKeyPart: readRequiredString(formData, "fsrsCacheKeyPart")
  });

  if (result.status === "applied") {
    invalidateReviewMutationCaches({
      policy: "review"
    });
  }

  redirect(
    buildHrefWithSearch("/settings", (params) => {
      if (result.status === "applied") {
        params.set("fsrsRescheduled", "1");
      } else if (result.status === "stale") {
        params.set("fsrsRescheduleStale", "1");
      } else {
        params.set("fsrsRescheduleNoop", "1");
      }

      if (returnTo) {
        params.set("returnTo", returnTo);
      }
    })
  );
}

function readRequiredInteger(formData: FormData, key: string) {
  const value = readRequiredString(formData, key);

  if (!/^-?\d+$/u.test(value)) {
    return Number.NaN;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}
