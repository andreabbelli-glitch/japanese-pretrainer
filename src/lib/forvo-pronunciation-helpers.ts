import path from "node:path";

import type { NormalizedMediaBundle } from "./content/types.ts";
import { buildEntryKey } from "./entry-id.ts";
import {
  collectPronunciationTargets,
  normalizePronunciationText,
  slugifySegment,
  type PronunciationTargetEntry
} from "./pronunciation-shared.ts";

type WordListRequest = {
  entryId?: string;
  raw: string;
  reading?: string;
  word?: string;
};

export type ForvoCandidate = {
  accent?: string;
  candidateIndex: number;
  pageUrl: string;
  sectionIndex: number;
  speaker?: string;
  speakerCountry?: string;
  speakerGender?: string;
  text: string;
  votes?: number;
};

export function parseForvoWordList(source: string) {
  return source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map<WordListRequest>((line) => {
      const parts = line.split("\t").map((part) => part.trim());

      if (parts.length === 1) {
        const only = parts[0] ?? "";
        return isEntryIdLike(only)
          ? { entryId: only, raw: line }
          : { raw: line, word: only };
      }

      return {
        entryId: parts[2] || undefined,
        raw: line,
        reading: parts[1] || undefined,
        word: parts[0] || undefined
      };
    });
}

export function parseForvoCandidateText(text: string) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const speakerMatch =
    normalizedText.match(
      /Pronunciation by\s+(.+?)\s+\((Male|Female)(?: from ([^)]+))?\)/iu
    ) ?? normalizedText.match(/Pronunciation by\s+(.+?)(?:\s{2,}|$)/iu);
  const votesMatch = normalizedText.match(/(-?\d+)\s+votes?\s+Good\s+Bad/iu);
  const accentMatch = normalizedText.match(
    /Accent:\s+(.+?)(?:\s{2,}|Pronunciation by|Download MP3|$)/iu
  );

  return {
    accent: accentMatch?.[1]?.trim(),
    speaker: speakerMatch?.[1]?.trim(),
    speakerCountry: speakerMatch?.[3]?.trim(),
    speakerGender: speakerMatch?.[2]?.trim(),
    text: normalizedText,
    votes:
      typeof votesMatch?.[1] === "string"
        ? Number.parseInt(votesMatch[1], 10)
        : undefined
  };
}

export function scoreForvoCandidate(candidate: ForvoCandidate) {
  let score = Math.max(0, 40 - candidate.sectionIndex * 2);

  if (candidate.speakerCountry) {
    score += /japan/iu.test(candidate.speakerCountry) ? 80 : -12;
  }

  if (candidate.accent) {
    score += /japan/iu.test(candidate.accent) ? 20 : 0;
  }

  if (candidate.speakerGender) {
    score += 4;
  }

  if (typeof candidate.votes === "number") {
    score += candidate.votes * 18;
  }

  return score;
}

export function selectBestForvoCandidate(candidates: ForvoCandidate[]) {
  return [...candidates]
    .sort((left, right) => {
      const scoreDelta = scoreForvoCandidate(right) - scoreForvoCandidate(left);

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return left.sectionIndex - right.sectionIndex;
    })
    .at(0);
}

export function resolveRequestedTargets(input: {
  bundle: NormalizedMediaBundle;
  entryIds?: string[];
  refresh?: boolean;
  wordListSource?: string;
  words?: string[];
}) {
  const rows = [
    ...(input.entryIds ?? []).map<WordListRequest>((entryId) => ({
      entryId,
      raw: entryId
    })),
    ...(input.words ?? []).map<WordListRequest>((word) => ({
      raw: word,
      word
    })),
    ...(input.wordListSource ? parseForvoWordList(input.wordListSource) : [])
  ];
  const allTargets = collectPronunciationTargets(input.bundle);
  const candidatesById = new Map(allTargets.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  const targets: PronunciationTargetEntry[] = [];
  const unresolved: Array<{ raw: string; reason: string }> = [];

  for (const row of rows) {
    const resolved = resolveWordListRow({
      candidatesById,
      refresh: input.refresh,
      row,
      targets: allTargets
    });

    if (!resolved.ok) {
      unresolved.push({
        raw: row.raw,
        reason: resolved.reason
      });
      continue;
    }

    const key = buildEntryKey(resolved.target.kind, resolved.target.id);

    if (seen.has(key)) {
      continue;
    }

    if (resolved.target.audioSrc && !input.refresh) {
      continue;
    }

    seen.add(key);
    targets.push(resolved.target);
  }

  return {
    targets,
    unresolved
  };
}

export function buildForvoWordUrls(entry: PronunciationTargetEntry) {
  return [
    ...new Set(
      expandForvoSearchVariants([entry.label, entry.reading, ...entry.aliases])
    )
  ].map((query) => `https://forvo.com/word/${encodeURIComponent(query)}/#ja`);
}

export function buildForvoAudioAssetPath(
  entry: PronunciationTargetEntry,
  candidate: ForvoCandidate
) {
  const speakerSegment = slugifyForvoSegment(candidate.speaker ?? "forvo");
  const labelSegment = slugifyForvoSegment(entry.reading ?? entry.label);

  return `assets/audio/${entry.kind}/${entry.id}/forvo-${speakerSegment}-${labelSegment}.mp3`;
}

export function buildForvoAttribution(candidate: ForvoCandidate) {
  if (candidate.speaker) {
    return `${candidate.speaker} via Forvo`;
  }

  return "Forvo";
}

export function doesManualDownloadMatchEntry(
  downloadedFile: string,
  entry: PronunciationTargetEntry
) {
  const basename = path.basename(downloadedFile, path.extname(downloadedFile));
  const normalizedFilename = normalizePronunciationText(
    (basename ?? "")
      .replace(/^pronunciation[_-]?ja[_-]?/iu, "")
      .replace(/\(\d+\)$/u, "")
      .trim()
  );
  const acceptableTargets = new Set(
    expandForvoSearchVariants([entry.label, entry.reading, ...entry.aliases])
      .map(normalizePronunciationText)
      .filter(Boolean)
  );

  return [...acceptableTargets].some(
    (candidate) =>
      normalizedFilename === candidate ||
      normalizedFilename.endsWith(candidate) ||
      normalizedFilename.includes(candidate)
  );
}

export function expandForvoSearchVariants(values: Array<string | undefined>) {
  return values
    .filter((value): value is string => typeof value === "string")
    .flatMap((value) => [
      value,
      ...value
        .split(/\s*[\/|]\s*/u)
        .map((segment) => segment.trim())
        .filter(Boolean)
    ]);
}

function isEntryIdLike(value: string) {
  return /^(term|grammar)-/u.test(value);
}

function resolveWordListRow(input: {
  candidatesById: Map<string, PronunciationTargetEntry>;
  refresh?: boolean;
  row: WordListRequest;
  targets: PronunciationTargetEntry[];
}):
  | { ok: true; target: PronunciationTargetEntry }
  | { ok: false; reason: string } {
  if (input.row.entryId) {
    const directMatch = input.candidatesById.get(input.row.entryId);

    return directMatch
      ? { ok: true, target: directMatch }
      : { ok: false, reason: `entry '${input.row.entryId}' not found` };
  }

  const searchNeedles = [input.row.word, input.row.reading]
    .filter((value): value is string => typeof value === "string")
    .map(normalizePronunciationText)
    .filter(Boolean);

  if (searchNeedles.length === 0) {
    return {
      ok: false,
      reason: "empty word row"
    };
  }

  const ranked = input.targets
    .map((target) => ({
      score: scoreTargetMatch(target, input.row),
      target
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0) {
    return {
      ok: false,
      reason: `no glossary match for '${input.row.raw}'`
    };
  }

  if (
    ranked.length > 1 &&
    ranked[0]?.score === ranked[1]?.score &&
    ranked[0]?.target.id !== ranked[1]?.target.id
  ) {
    return {
      ok: false,
      reason: `ambiguous glossary match for '${input.row.raw}'`
    };
  }

  return {
    ok: true,
    target: ranked[0]!.target
  };
}

function scoreTargetMatch(
  target: PronunciationTargetEntry,
  row: WordListRequest
) {
  const rowWord = normalizePronunciationText(row.word ?? "");
  const rowReading = normalizePronunciationText(row.reading ?? "");
  const label = normalizePronunciationText(target.label);
  const reading = normalizePronunciationText(target.reading ?? "");
  const aliases = new Set(target.aliases.map(normalizePronunciationText));
  let score = 0;

  if (rowWord.length > 0) {
    if (label === rowWord) {
      score += 70;
    }

    if (reading === rowWord) {
      score += 55;
    }

    if (aliases.has(rowWord)) {
      score += 30;
    }
  }

  if (rowReading.length > 0) {
    if (reading === rowReading) {
      score += 45;
    }

    if (aliases.has(rowReading)) {
      score += 20;
    }
  }

  if (score > 0 && !target.audioSrc) {
    score += 3;
  }

  return score;
}

export function slugifyForvoSegment(value: string) {
  return slugifySegment(value, "audio");
}
