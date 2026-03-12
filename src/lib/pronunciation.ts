import {
  buildPitchAccentData,
  type PitchAccentData
} from "./pitch-accent";
import { mediaAssetHref } from "./site";

export type PronunciationData = {
  attribution?: string;
  label?: string;
  license?: string;
  pageUrl?: string;
  pitchAccent?: PitchAccentData;
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
