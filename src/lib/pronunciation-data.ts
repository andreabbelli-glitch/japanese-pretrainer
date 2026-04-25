import {
  buildPitchAccentData,
  type PitchAccentData
} from "./pitch-accent.ts";
import { mediaAssetHref } from "./site.ts";

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
  src?: ReturnType<typeof mediaAssetHref>;
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
    src: entry.audioSrc ? mediaAssetHref(mediaSlug, entry.audioSrc) : undefined
  };
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
