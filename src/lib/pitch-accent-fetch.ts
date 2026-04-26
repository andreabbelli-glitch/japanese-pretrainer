import {
  getPitchAccentCheckStatus,
  type PronunciationManifestEntry
} from "./content/pronunciations-manifest.ts";
import type {
  EntryAudioMetadata,
  NormalizedGrammarPattern,
  NormalizedMediaBundle,
  NormalizedTerm,
  PitchAccentCheckStatus
} from "./content/types.ts";
import { buildEntryKey } from "./entry-id.ts";
import { createFetchThrottle, sleep } from "./fetch-throttle.ts";
import {
  loadValidatedManifest,
  persistManifestEntries
} from "./manifest-helpers.ts";
import {
  normalizePronunciationText,
  type EntryKind,
  type PronunciationFetchNetworkOptions
} from "./pronunciation-shared.ts";

type PitchAccentSourceKey = "wiktionary" | "ojad";

type PitchAccentFetchTarget = {
  aliases: string[];
  audio?: EntryAudioMetadata;
  id: string;
  kind: EntryKind;
  label: string;
  mediaDirectory: string;
  mediaSlug: string;
  pitchAccent?: number;
  pitchAccentPageUrl?: string;
  pitchAccentSource?: string;
  reading?: string;
};

type PitchAccentLookup = {
  pageUrl: string;
  pitchAccent: number;
  query: string;
  sourceKey: PitchAccentSourceKey;
  sourceLabel: string;
};

export type PitchAccentResult =
  | {
      entryId: string;
      kind: EntryKind;
      pitchAccent: number;
      source: PitchAccentLookup;
      status: "resolved";
    }
  | {
      entryId: string;
      kind: EntryKind;
      status: "miss" | "skipped_existing" | "source_error";
      detail?: string;
    };

type PitchAccentWordListRequest = {
  entryId?: string;
  raw: string;
  reading?: string;
  word?: string;
};

export type PitchAccentRequestedUnresolved = {
  raw: string;
  reason: string;
};

type OjadCandidate = {
  pitchAccent: number;
  query: string;
  reading: string;
  score: number;
  title: string;
};

type WiktionaryTemplate = {
  accent: number;
  reading?: string;
};

const DEFAULT_REQUEST_DELAY_MS = 400;
const pitchAccentFetchThrottle = createFetchThrottle({
  requestDelayMs: DEFAULT_REQUEST_DELAY_MS
});

export async function fetchPitchAccentsForBundle(input: {
  bundle: NormalizedMediaBundle;
  dryRun?: boolean;
  entryIds?: string[];
  entryDelayMs?: number;
  limit?: number;
  network?: PronunciationFetchNetworkOptions;
  refresh?: boolean;
  wordListSource?: string;
  words?: string[];
}) {
  const allTargets = collectPitchAccentTargets(input.bundle);
  const requestedTargets = resolvePitchAccentRequestedTargets({
    bundle: input.bundle,
    entryIds: input.entryIds,
    wordListSource: input.wordListSource,
    words: input.words
  });
  const selectedTargets = hasRequestedPitchAccentTargets(input)
    ? requestedTargets.targets
    : allTargets;
  const { entries: manifestEntries } = await loadValidatedManifest(
    input.bundle.mediaDirectory,
    input.bundle.mediaSlug
  );
  const targets = input.refresh
    ? selectedTargets
    : selectedTargets.filter((entry) =>
        shouldFetchPitchAccentEntry(
          entry,
          manifestEntries.get(buildEntryKey(entry.kind, entry.id))
        )
      );
  const limitedTargets =
    typeof input.limit === "number" && input.limit >= 0
      ? targets.slice(0, input.limit)
      : targets;
  const results: PitchAccentResult[] = [];

  for (const [index, entry] of limitedTargets.entries()) {
    if (index > 0 && (input.entryDelayMs ?? 0) > 0) {
      await sleep(input.entryDelayMs ?? 0);
    }

    const resolved = await resolvePitchAccentForEntry({
      entry,
      network: input.network
    });
    results.push(resolved);

    const manifestKey = buildEntryKey(entry.kind, entry.id);
    const manifestEntry =
      manifestEntries.get(manifestKey) ?? buildManifestEntryFromTarget(entry);
    const updatedManifestEntry = updateManifestEntryWithPitchAccentResult(
      manifestEntry,
      resolved
    );
    manifestEntries.set(manifestKey, updatedManifestEntry);

    if (!input.dryRun) {
      await persistManifestEntries(
        input.bundle.mediaDirectory,
        manifestEntries
      );
    }
  }

  return {
    errors: results.filter((result) => result.status === "source_error").length,
    missed: results.filter((result) => result.status === "miss").length,
    requestedUnresolved: requestedTargets.unresolved,
    resolved: results.filter((result) => result.status === "resolved").length,
    results,
    skipped: selectedTargets.length - targets.length
  };
}

export function parsePitchAccentWordList(source: string) {
  const trimmed = source.trim();

  if (trimmed.length === 0) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    return parsePitchAccentWordListJson(trimmed);
  }

  return source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map<PitchAccentWordListRequest>((line) => {
      const parts = line.split("\t").map((part) => part.trim());

      if (parts.length === 1) {
        return pitchAccentRequestFromSingleValue(parts[0] ?? "", line);
      }

      return {
        entryId: parts[2] || undefined,
        raw: line,
        reading: parts[1] || undefined,
        word: parts[0] || undefined
      };
    });
}

export function resolvePitchAccentRequestedTargets(input: {
  bundle: NormalizedMediaBundle;
  entryIds?: string[];
  wordListSource?: string;
  words?: string[];
}) {
  const rows = [
    ...(input.entryIds ?? []).map<PitchAccentWordListRequest>((entryId) => ({
      entryId,
      raw: entryId
    })),
    ...(input.words ?? []).map<PitchAccentWordListRequest>((word) => ({
      raw: word,
      word
    })),
    ...(input.wordListSource
      ? parsePitchAccentWordList(input.wordListSource)
      : [])
  ];
  const allTargets = collectPitchAccentTargets(input.bundle);
  const candidatesById = new Map(allTargets.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  const targets: PitchAccentFetchTarget[] = [];
  const unresolved: PitchAccentRequestedUnresolved[] = [];

  for (const row of rows) {
    const resolved = resolvePitchAccentWordListRow({
      candidatesById,
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

    seen.add(key);
    targets.push(resolved.target);
  }

  return {
    targets,
    unresolved
  };
}

export async function resolvePitchAccentForEntry(input: {
  entry: PitchAccentFetchTarget;
  network?: PronunciationFetchNetworkOptions;
}): Promise<PitchAccentResult> {
  const errors: string[] = [];

  try {
    const wiktionary = await lookupWiktionaryPitchAccent({
      entry: input.entry,
      network: input.network
    });

    if (wiktionary) {
      return {
        entryId: input.entry.id,
        kind: input.entry.kind,
        pitchAccent: wiktionary.pitchAccent,
        source: wiktionary,
        status: "resolved"
      };
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    const ojad = await lookupOjadPitchAccent({
      entry: input.entry,
      network: input.network
    });

    if (ojad) {
      return {
        entryId: input.entry.id,
        kind: input.entry.kind,
        pitchAccent: ojad.pitchAccent,
        source: ojad,
        status: "resolved"
      };
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  if (errors.length > 0) {
    return {
      detail: errors.join(" | "),
      entryId: input.entry.id,
      kind: input.entry.kind,
      status: "source_error"
    };
  }

  return {
    entryId: input.entry.id,
    kind: input.entry.kind,
    status: "miss"
  };
}

export async function lookupWiktionaryPitchAccent(input: {
  entry: PitchAccentFetchTarget;
  network?: PronunciationFetchNetworkOptions;
}) {
  const titles = buildWiktionaryTitles(input.entry);

  for (const host of ["en.wiktionary.org"] as const) {
    for (const title of titles) {
      const response = await fetchJson<{
        query?: {
          pages?: Array<{
            missing?: boolean;
            revisions?: Array<{
              slots?: {
                main?: {
                  content?: string;
                };
              };
            }>;
            title?: string;
          }>;
        };
      }>({
        network: input.network,
        url: `https://${host}/w/api.php?action=query&format=json&formatversion=2&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(title)}`
      });
      const page = response.query?.pages?.[0];

      if (!page || page.missing) {
        continue;
      }

      const source = page.revisions?.[0]?.slots?.main?.content ?? "";
      const values = extractPitchAccentFromWiktionaryWikitext(
        source,
        input.entry
      );

      if (values.length !== 1) {
        continue;
      }

      const resolvedTitle = page.title ?? title;

      return {
        pageUrl: `https://${host}/wiki/${encodeURIComponent(resolvedTitle)}`,
        pitchAccent: values[0]!,
        query: title,
        sourceKey: "wiktionary" as const,
        sourceLabel: "Wiktionary"
      };
    }
  }

  return null;
}

export async function lookupOjadPitchAccent(input: {
  entry: PitchAccentFetchTarget;
  network?: PronunciationFetchNetworkOptions;
}) {
  const queries = buildOjadQueries(input.entry);
  let best: OjadCandidate | null = null;

  for (const query of queries) {
    const url = `https://www.gavo.t.u-tokyo.ac.jp/ojad/search/index/word:${encodeURIComponent(query)}`;
    let html: string;

    try {
      html = await fetchText({
        network: input.network,
        url
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        continue;
      }

      throw error;
    }
    const matches = extractPitchAccentCandidatesFromOjadHtml(html);

    for (const candidate of matches) {
      const score = scoreOjadCandidate(input.entry, candidate, query);

      if (!best || score > best.score) {
        best = {
          ...candidate,
          query,
          score
        };
      }
    }
  }

  if (!best || best.score < 120) {
    return null;
  }

  return {
    pageUrl: `https://www.gavo.t.u-tokyo.ac.jp/ojad/search/index/word:${encodeURIComponent(best.query)}`,
    pitchAccent: best.pitchAccent,
    query: best.query,
    sourceKey: "ojad" as const,
    sourceLabel: "OJAD"
  };
}

export function extractPitchAccentFromWiktionaryWikitext(
  source: string,
  entry: Pick<PitchAccentFetchTarget, "aliases" | "label" | "reading">
) {
  const templates: WiktionaryTemplate[] = [];

  for (const match of source.matchAll(/\{\{ja-pron\|([\s\S]*?)\}\}/giu)) {
    const body = match[1] ?? "";
    const parts = body.split("|").map((part) => part.trim());
    const named = new Map<string, string>();
    const positional: string[] = [];

    for (const part of parts) {
      const separatorIndex = part.indexOf("=");

      if (separatorIndex > 0) {
        named.set(
          part.slice(0, separatorIndex).trim(),
          part.slice(separatorIndex + 1).trim()
        );
      } else if (part.length > 0) {
        positional.push(part);
      }
    }

    const reading = positional[0];
    const accent = parsePitchAccentValue(named.get("acc"));

    if (accent === null) {
      continue;
    }

    if (
      reading &&
      !matchesPitchAccentTarget(entry, reading) &&
      !matchesPitchAccentTarget(entry, reading.replace(/[・･]/gu, ""))
    ) {
      continue;
    }

    templates.push({
      accent,
      reading
    });
  }

  return [...new Set(templates.map((template) => template.accent))];
}

export function extractPitchAccentCandidatesFromOjadHtml(html: string) {
  const rows = html.match(/<tr id="word_[^"]+"[\s\S]*?<\/tr>/giu) ?? [];
  const candidates: Array<{
    pitchAccent: number;
    reading: string;
    title: string;
  }> = [];

  for (const row of rows) {
    const title = stripHtml(
      row.match(/<p class="midashi_word">([\s\S]*?)<\/p>/iu)?.[1]
    );
    const accentCell = row.match(
      /<td class="katsuyo katsuyo_jisho_js">[\s\S]*?<\/td>/iu
    )?.[0];

    if (!title || !accentCell) {
      continue;
    }

    const spans = [
      ...accentCell.matchAll(
        /<span class="([^"]+)"><span class="inner"><span class="char">([^<]+)<\/span>/giu
      )
    ].map((match) => ({
      char: match[2] ?? "",
      classes: match[1]?.trim().split(/\s+/u) ?? []
    }));

    if (spans.length === 0) {
      continue;
    }

    const accentTopIndex = spans.findIndex((span) =>
      span.classes.includes("accent_top")
    );
    const accentPlainPresent = spans.some((span) =>
      span.classes.includes("accent_plain")
    );
    const pitchAccent =
      accentTopIndex >= 0 ? accentTopIndex + 1 : accentPlainPresent ? 0 : null;

    if (pitchAccent === null) {
      continue;
    }

    candidates.push({
      pitchAccent,
      reading: spans.map((span) => span.char).join(""),
      title
    });
  }

  return candidates;
}

function buildWiktionaryTitles(entry: PitchAccentFetchTarget) {
  const rawValues =
    entry.kind === "grammar"
      ? [entry.reading, entry.label]
      : [entry.label, entry.reading];

  return dedupeLookupValues(rawValues);
}

function buildOjadQueries(entry: PitchAccentFetchTarget) {
  const rawValues = [
    entry.reading,
    isMostlyKana(entry.label) ? entry.label : undefined
  ].flatMap((value) => splitLookupVariants(value));

  return dedupeLookupValues(rawValues).filter((value) => isMostlyKana(value));
}

function splitLookupVariants(value: string | undefined) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/\s*[\/／]\s*/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function dedupeLookupValues(values: Array<string | undefined>) {
  const deduped = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim().replace(/^[～〜~]+/u, "");

    if (normalized.length === 0 || !containsJapaneseScript(normalized)) {
      continue;
    }

    deduped.add(normalized);
  }

  return [...deduped];
}

function containsJapaneseScript(value: string) {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(value);
}

function isMostlyKana(value: string) {
  return /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
}

function collectPitchAccentTargets(bundle: NormalizedMediaBundle) {
  return [
    ...bundle.terms.map((entry) =>
      mapToPitchAccentTarget(bundle, entry, "term")
    ),
    ...bundle.grammarPatterns.map((entry) =>
      mapToPitchAccentTarget(bundle, entry, "grammar")
    )
  ];
}

function hasRequestedPitchAccentTargets(input: {
  entryIds?: string[];
  wordListSource?: string;
  words?: string[];
}) {
  return (
    (input.entryIds?.length ?? 0) > 0 ||
    (input.words?.length ?? 0) > 0 ||
    typeof input.wordListSource === "string"
  );
}

function parsePitchAccentWordListJson(source: string) {
  const parsed = JSON.parse(source) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Pitch accent words JSON must be an array.");
  }

  return parsed.map<PitchAccentWordListRequest>((item, index) => {
    if (typeof item === "string") {
      return pitchAccentRequestFromSingleValue(item, item);
    }

    if (isPitchAccentWordListObject(item)) {
      const raw = JSON.stringify(item);

      return {
        entryId: item.entryId ?? item.entry_id,
        raw,
        reading: item.reading,
        word: item.word
      };
    }

    throw new Error(
      `Pitch accent words JSON item ${index + 1} must be a string or object.`
    );
  });
}

function isPitchAccentWordListObject(value: unknown): value is {
  entryId?: string;
  entry_id?: string;
  reading?: string;
  word?: string;
} {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pitchAccentRequestFromSingleValue(
  value: string,
  raw: string
): PitchAccentWordListRequest {
  return isEntryIdLike(value) ? { entryId: value, raw } : { raw, word: value };
}

function resolvePitchAccentWordListRow(input: {
  candidatesById: Map<string, PitchAccentFetchTarget>;
  row: PitchAccentWordListRequest;
  targets: PitchAccentFetchTarget[];
}):
  | { ok: true; target: PitchAccentFetchTarget }
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
      score: scorePitchAccentTargetMatch(target, input.row),
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

function scorePitchAccentTargetMatch(
  target: PitchAccentFetchTarget,
  row: PitchAccentWordListRequest
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

  if (score > 0 && target.pitchAccent === undefined) {
    score += 3;
  }

  return score;
}

function isEntryIdLike(value: string) {
  return /^(term|grammar)-/u.test(value);
}

function mapToPitchAccentTarget(
  bundle: NormalizedMediaBundle,
  entry: NormalizedGrammarPattern | NormalizedTerm,
  kind: "grammar" | "term"
): PitchAccentFetchTarget {
  const label =
    kind === "term"
      ? (entry as NormalizedTerm).lemma
      : (entry as NormalizedGrammarPattern).pattern;
  const reading =
    kind === "term"
      ? entry.reading
      : (entry.reading ?? (entry as NormalizedGrammarPattern).pattern);

  return {
    aliases: entry.aliases,
    audio: entry.audio,
    id: entry.id,
    kind,
    label,
    mediaDirectory: bundle.mediaDirectory,
    mediaSlug: bundle.mediaSlug,
    pitchAccent: entry.pitchAccent,
    pitchAccentPageUrl: entry.pitchAccentPageUrl,
    pitchAccentSource: entry.pitchAccentSource,
    reading
  };
}

function buildManifestEntryFromTarget(
  entry: PitchAccentFetchTarget
): PronunciationManifestEntry {
  return {
    audioAttribution: entry.audio?.audioAttribution,
    audioLicense: entry.audio?.audioLicense,
    audioPageUrl: entry.audio?.audioPageUrl,
    audioSource: entry.audio?.audioSource,
    audioSpeaker: entry.audio?.audioSpeaker,
    audioSrc: entry.audio?.audioSrc,
    entryId: entry.id,
    entryType: entry.kind,
    pitchAccent: entry.pitchAccent,
    pitchAccentPageUrl: entry.pitchAccentPageUrl,
    pitchAccentSource: entry.pitchAccentSource,
    pitchAccentStatus: entry.pitchAccent !== undefined ? "resolved" : undefined
  };
}

function shouldFetchPitchAccentEntry(
  entry: PitchAccentFetchTarget,
  manifestEntry: PronunciationManifestEntry | undefined
) {
  if (entry.pitchAccent !== undefined) {
    return false;
  }

  const status = manifestEntry
    ? getPitchAccentCheckStatus(manifestEntry)
    : undefined;

  return status === undefined || status === "source_error";
}

function updateManifestEntryWithPitchAccentResult(
  manifestEntry: PronunciationManifestEntry,
  result: PitchAccentResult
): PronunciationManifestEntry {
  if (result.status === "resolved") {
    return {
      ...manifestEntry,
      pitchAccent: result.pitchAccent,
      pitchAccentPageUrl: result.source.pageUrl,
      pitchAccentSource: result.source.sourceLabel,
      pitchAccentStatus: "resolved"
    };
  }

  if (manifestEntry.pitchAccent !== undefined) {
    return {
      ...manifestEntry,
      pitchAccentStatus: "resolved"
    };
  }

  return {
    ...manifestEntry,
    pitchAccent: undefined,
    pitchAccentPageUrl: undefined,
    pitchAccentSource: undefined,
    pitchAccentStatus: mapResultStatusToPitchAccentCheckStatus(result.status)
  };
}

function mapResultStatusToPitchAccentCheckStatus(
  status: PitchAccentResult["status"]
): PitchAccentCheckStatus {
  if (status === "skipped_existing") {
    throw new Error(
      "Unexpected skipped_existing status while persisting pitch accent results."
    );
  }

  return status;
}

function matchesPitchAccentTarget(
  entry: Pick<PitchAccentFetchTarget, "aliases" | "label" | "reading">,
  value: string
) {
  const normalized = normalizePronunciationText(value);

  if (normalized.length === 0) {
    return false;
  }

  return [entry.label, entry.reading, ...entry.aliases]
    .filter((candidate): candidate is string => typeof candidate === "string")
    .some((candidate) => normalizePronunciationText(candidate) === normalized);
}

function parsePitchAccentValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!/^\d+$/u.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function scoreOjadCandidate(
  entry: PitchAccentFetchTarget,
  candidate: OjadCandidate | Omit<OjadCandidate, "query" | "score">,
  query: string
) {
  let score = 0;
  const normalizedTitle = normalizePronunciationText(candidate.title);
  const normalizedReading = normalizePronunciationText(candidate.reading);
  const normalizedQuery = normalizePronunciationText(query);
  const normalizedLabel = normalizePronunciationText(entry.label);
  const normalizedEntryReading = entry.reading
    ? normalizePronunciationText(entry.reading)
    : "";

  if (
    normalizedReading.length > 0 &&
    normalizedReading === normalizedEntryReading
  ) {
    score += 220;
  }

  if (
    normalizedTitle === normalizedLabel ||
    normalizedTitle.includes(normalizedLabel)
  ) {
    score += 140;
  }

  if (
    normalizedEntryReading.length > 0 &&
    (normalizedTitle === normalizedEntryReading ||
      normalizedTitle.includes(normalizedEntryReading))
  ) {
    score += 100;
  }

  if (
    normalizedReading === normalizedQuery ||
    normalizedTitle.includes(normalizedQuery)
  ) {
    score += 60;
  }

  return score;
}

async function fetchJson<T>(input: {
  network?: PronunciationFetchNetworkOptions;
  url: string;
}) {
  const body = await fetchText(input);
  return JSON.parse(body) as T;
}

async function fetchText(input: {
  network?: PronunciationFetchNetworkOptions;
  url: string;
}) {
  const response = await pitchAccentFetchThrottle.fetchWithRetry(
    input.url,
    {
      headers: {
        "User-Agent": "japanese-custom-study/0.1 pitch-accent fetcher"
      }
    },
    input.network
  );

  return await response.text();
}

function isNotFoundError(error: unknown) {
  return error instanceof Error && /:\s404\b/u.test(error.message);
}

function stripHtml(value: string | undefined) {
  if (!value) {
    return null;
  }

  const stripped = value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return stripped.length > 0 ? stripped : null;
}
