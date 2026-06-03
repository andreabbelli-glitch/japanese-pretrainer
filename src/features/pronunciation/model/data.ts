import {
  buildPitchAccentData,
  type PitchAccentData
} from "../../pitch-accent/model/notation.ts";
import { mediaAudioAssetHref } from "../../navigation/index.ts";

export type PronunciationData = {
  attribution?: string;
  label?: string;
  license?: string;
  pageUrl?: string;
  pitchAccent?: PitchAccentData;
  pitchAccentPageUrl?: string;
  pitchAccentSource?: string;
  source?: string;
  speaker?: string;
  src?: ReturnType<typeof mediaAudioAssetHref>;
};

export function buildPronunciationData(
  mediaSlug: string,
  entry: {
    audioAttribution?: string | null;
    audioLicense?: string | null;
    audioPageUrl?: string | null;
    pitchAccent?: number | null;
    pitchAccentPageUrl?: string | null;
    pitchAccentSource?: string | null;
    reading?: string | null;
    audioSource?: string | null;
    audioSpeaker?: string | null;
    audioSrc?: string | null;
    audioUpdatedAt?: Date | string | null;
    updatedAt?: Date | string | null;
  }
): PronunciationData | null {
  const pitchAccent =
    buildPitchAccentData(entry.reading, entry.pitchAccent) ?? undefined;

  if (!entry.audioSrc && !pitchAccent) {
    return null;
  }

  return {
    attribution: entry.audioAttribution ?? undefined,
    label: buildPronunciationLabel(entry),
    license: entry.audioLicense ?? undefined,
    pageUrl: entry.audioPageUrl ?? undefined,
    pitchAccent,
    pitchAccentPageUrl: entry.pitchAccentPageUrl ?? undefined,
    pitchAccentSource: entry.pitchAccentSource ?? undefined,
    source: entry.audioSource ?? undefined,
    speaker: entry.audioSpeaker ?? undefined,
    src: entry.audioSrc
      ? mediaAudioAssetHref(
          mediaSlug,
          entry.audioSrc,
          chooseAudioAssetVersion(entry.audioUpdatedAt, entry.updatedAt)
        )
      : undefined
  };
}

function chooseAudioAssetVersion(
  primary?: Date | string | null,
  fallback?: Date | string | null
) {
  if (primary instanceof Date) {
    return primary;
  }

  if (typeof primary === "string" && primary.trim().length > 0) {
    return primary;
  }

  return fallback;
}

function buildPronunciationLabel(entry: {
  audioSource?: string | null;
  audioSpeaker?: string | null;
}) {
  if (entry.audioSpeaker && entry.audioSource) {
    return `${entry.audioSpeaker} · ${entry.audioSource}`;
  }

  return entry.audioSpeaker ?? entry.audioSource ?? undefined;
}
