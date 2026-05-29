import {
  buildPitchAccentData,
  normalizePitchAccentReading
} from "@/features/pitch-accent/model";

import type { PitchAccentPairOption } from "@/features/pitch-accent/model";

export function formatPitchAccentPercent(
  correct: number,
  total: number
): string {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.round((correct / total) * 100)}%`;
}

export function formatPitchAccentCount(value: number): string {
  return Math.trunc(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function buildPitchAccentOptionData(option: PitchAccentPairOption) {
  return buildPitchAccentData(
    normalizePitchAccentReading(option.rawPronunciation),
    option.pitchAccent
  );
}

export function formatPitchAccentOptionLabel(option: PitchAccentPairOption) {
  return `${normalizePitchAccentReading(
    option.rawPronunciation
  )} ${formatAccentDrop(option)}`;
}

function formatAccentDrop(option: PitchAccentPairOption) {
  if (option.accentedMora === 0) {
    return "heiban";
  }

  return `drop ${option.accentedMora}`;
}
