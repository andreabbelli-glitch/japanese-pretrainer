"use client";

import type { KanjiClashSessionActionResult } from "@/features/kanji-clash/types";

export function resolveKanjiClashSubmitLiveMessage(
  result: KanjiClashSessionActionResult
) {
  if (!result.isCorrect) {
    return null;
  }

  return result.nextRound
    ? "Risposta corretta. Round successivo caricato."
    : "Risposta corretta. Sessione completata.";
}
