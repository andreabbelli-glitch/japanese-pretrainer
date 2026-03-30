import type {
  NormalizedGrammarPattern,
  NormalizedMediaBundle,
  NormalizedTerm
} from "./content/types.ts";

export type EntryKind = "term" | "grammar";

export type PronunciationFetchNetworkOptions = {
  maxRetries?: number;
  requestDelayMs?: number;
  requestTimeoutMs?: number;
  retryBaseDelayMs?: number;
};

export type PronunciationTargetEntry = {
  aliases: string[];
  audioSrc?: string;
  crossMediaGroup?: string;
  id: string;
  kind: EntryKind;
  label: string;
  mediaDirectory: string;
  mediaSlug: string;
  reading?: string;
};

export function collectPronunciationTargets(bundle: NormalizedMediaBundle) {
  return [
    ...bundle.terms.map((entry) =>
      mapToPronunciationTarget(bundle, entry, "term")
    ),
    ...bundle.grammarPatterns.map((entry) =>
      mapToPronunciationTarget(bundle, entry, "grammar")
    )
  ];
}

export function normalizePronunciationText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/^file:/i, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[～〜~\s/|・._-]+/g, "")
    .toLowerCase();
}

export function slugifySegment(value: string, fallback?: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized.length > 0 ? normalized : (fallback ?? normalized);
}

function mapToPronunciationTarget(
  bundle: NormalizedMediaBundle,
  entry: NormalizedGrammarPattern | NormalizedTerm,
  kind: "grammar" | "term"
): PronunciationTargetEntry {
  const label =
    kind === "term"
      ? (entry as NormalizedTerm).lemma
      : (entry as NormalizedGrammarPattern).pattern;

  return {
    aliases: entry.aliases,
    audioSrc: entry.audio?.audioSrc,
    crossMediaGroup: entry.crossMediaGroup,
    id: entry.id,
    kind,
    label,
    mediaDirectory: bundle.mediaDirectory,
    mediaSlug: bundle.mediaSlug,
    reading: entry.reading
  };
}
