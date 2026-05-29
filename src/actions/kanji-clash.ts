"use server";

import { invalidateKanjiClashManualContrastChanged } from "@/features/cache/server";
import {
  archiveKanjiClashManualContrast,
  restoreKanjiClashManualContrast,
  submitKanjiClashAnswer
} from "@/features/kanji-clash/server";

type SubmitKanjiClashAnswerActionInput = Parameters<
  typeof submitKanjiClashAnswer
>[0];
type ArchiveKanjiClashManualContrastActionInput = Parameters<
  typeof archiveKanjiClashManualContrast
>[0];
type RestoreKanjiClashManualContrastActionInput = Parameters<
  typeof restoreKanjiClashManualContrast
>[0];

export async function submitKanjiClashAnswerAction(
  input: SubmitKanjiClashAnswerActionInput
) {
  return submitKanjiClashAnswer(input);
}

export async function archiveKanjiClashManualContrastAction(
  input: ArchiveKanjiClashManualContrastActionInput
) {
  const contrastKey = input.contrastKey.trim();

  if (!contrastKey) {
    throw new Error("Missing Kanji Clash manual contrast key.");
  }

  await archiveKanjiClashManualContrast({
    contrastKey,
    database: input.database,
    now: input.now
  });
  invalidateKanjiClashManualContrastChanged();
}

export async function restoreKanjiClashManualContrastAction(
  input: RestoreKanjiClashManualContrastActionInput
) {
  const contrastKey = input.contrastKey.trim();

  if (!contrastKey) {
    throw new Error("Missing Kanji Clash manual contrast key.");
  }

  await restoreKanjiClashManualContrast({
    contrastKey,
    database: input.database,
    now: input.now
  });
  invalidateKanjiClashManualContrastChanged();
}
