import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  loadPronunciationManifest,
  serializePronunciationManifest,
  type PronunciationManifestEntry
} from "./content/pronunciations-manifest.ts";
import type {
  EntryAudioMetadata,
  NormalizedGrammarPattern,
  NormalizedMediaBundle,
  NormalizedTerm
} from "./content/types.ts";
import { buildEntryKey } from "./entry-id.ts";
import {
  normalizePronunciationText,
  parseRetryAfterMs,
  type PronunciationFetchNetworkOptions
} from "./pronunciation-fetch.ts";

type EntryKind = "term" | "grammar";
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
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_RETRY_BASE_DELAY_MS = 5000;
const DEFAULT_MAX_RETRIES = 4;

let nextAllowedNetworkRequestAt = 0;

export async function fetchPitchAccentsForBundle(input: {
  bundle: NormalizedMediaBundle;
  dryRun?: boolean;
  limit?: number;
  network?: PronunciationFetchNetworkOptions;
  refresh?: boolean;
}) {
  const allTargets = collectPitchAccentTargets(input.bundle);
  const targets = input.refresh
    ? allTargets
    : allTargets.filter((entry) => entry.pitchAccent === undefined);
  const limitedTargets =
    typeof input.limit === "number" && input.limit >= 0
      ? targets.slice(0, input.limit)
      : targets;
  const manifestState = await loadPronunciationManifest(
    input.bundle.mediaDirectory
  );

  if (manifestState.issues.length > 0) {
    throw new Error(
      `Cannot update pitch accents for '${input.bundle.mediaSlug}' because pronunciations.json is invalid.`
    );
  }

  const manifestEntries = new Map<string, PronunciationManifestEntry>(
    (manifestState.manifest?.entries ?? []).map((entry) => [
      buildEntryKey(entry.entryType, entry.entryId),
      entry
    ])
  );
  const results: PitchAccentResult[] = [];

  for (const entry of limitedTargets) {
    const resolved = await resolvePitchAccentForEntry({
      entry,
      network: input.network
    });
    results.push(resolved);

    if (resolved.status !== "resolved") {
      continue;
    }

    const manifestKey = buildEntryKey(entry.kind, entry.id);
    const manifestEntry =
      manifestEntries.get(manifestKey) ?? buildManifestEntryFromTarget(entry);

    if (!manifestEntry) {
      continue;
    }

    manifestEntries.set(manifestKey, {
      ...manifestEntry,
      pitchAccent: resolved.pitchAccent,
      pitchAccentPageUrl: resolved.source.pageUrl,
      pitchAccentSource: resolved.source.sourceLabel
    });
  }

  if (!input.dryRun) {
    await mkdir(input.bundle.mediaDirectory, { recursive: true });
    await writeFile(
      path.join(input.bundle.mediaDirectory, "pronunciations.json"),
      serializePronunciationManifest({
        entries: [...manifestEntries.values()],
        version: 1
      })
    );
  }

  return {
    errors: results.filter((result) => result.status === "source_error").length,
    missed: results.filter((result) => result.status === "miss").length,
    resolved: results.filter((result) => result.status === "resolved").length,
    results,
    skipped: allTargets.length - targets.length
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
    pitchAccentSource: entry.pitchAccentSource
  };
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
  const requestDelayMs =
    input.network?.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS;
  const requestTimeoutMs =
    input.network?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const retryBaseDelayMs =
    input.network?.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const maxRetries = input.network?.maxRetries ?? DEFAULT_MAX_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    await waitForNextNetworkSlot(requestDelayMs);

    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, requestTimeoutMs);
    let response: Response;
    let responseBody: string;

    try {
      response = await fetch(input.url, {
        headers: {
          "User-Agent": "japanese-custom-study/0.1 pitch-accent fetcher"
        },
        signal: abortController.signal
      });

      responseBody = await response.text();
    } catch (error) {
      clearTimeout(timeout);

      if (attempt < maxRetries) {
        await sleep(retryBaseDelayMs * 2 ** attempt);
        continue;
      }

      throw new Error(
        `Failed to fetch ${input.url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    clearTimeout(timeout);

    if (response.ok) {
      return responseBody;
    }

    if (
      (response.status === 429 || response.status >= 500) &&
      attempt < maxRetries
    ) {
      const retryDelayMs =
        parseRetryAfterMs(response.headers.get("retry-after")) ??
        retryBaseDelayMs * 2 ** attempt;

      await sleep(retryDelayMs);
      continue;
    }

    throw new Error(
      `Failed to fetch ${input.url}: ${response.status} ${response.statusText}`
    );
  }

  throw new Error(`Failed to fetch ${input.url}: exhausted retries`);
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

async function waitForNextNetworkSlot(requestDelayMs: number) {
  const now = Date.now();
  const waitMs = Math.max(0, nextAllowedNetworkRequestAt - now);

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  nextAllowedNetworkRequestAt = Date.now() + Math.max(0, requestDelayMs);
}

async function sleep(durationMs: number) {
  if (durationMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, durationMs));
}
