import { mediaAssetHref } from "./site";

export type PronunciationData = {
  attribution?: string;
  label?: string;
  license?: string;
  pageUrl?: string;
  source?: string;
  speaker?: string;
  src: ReturnType<typeof mediaAssetHref>;
};

export function buildPronunciationData(
  mediaSlug: string,
  entry: {
    audioAttribution?: string | null;
    audioLicense?: string | null;
    audioPageUrl?: string | null;
    audioSource?: string | null;
    audioSpeaker?: string | null;
    audioSrc?: string | null;
  }
): PronunciationData | null {
  if (!entry.audioSrc) {
    return null;
  }

  return {
    attribution: entry.audioAttribution ?? undefined,
    label: buildPronunciationLabel(entry),
    license: entry.audioLicense ?? undefined,
    pageUrl: entry.audioPageUrl ?? undefined,
    source: entry.audioSource ?? undefined,
    speaker: entry.audioSpeaker ?? undefined,
    src: mediaAssetHref(mediaSlug, entry.audioSrc)
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
