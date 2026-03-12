import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
import {
  normalizePronunciationText,
  parseRetryAfterMs,
  type PronunciationFetchNetworkOptions
} from "./pronunciation-fetch.ts";

type EntryKind = "term" | "grammar";

type PitchAccentSource = "ojad" | "wiktionary";

type PitchAccentFetchTarget = {
  aliases: string[];
  audio?: EntryAudioMetadata;
  id: string;
  kind: EntryKind;
  label: string;
  mediaDirectory: string;
  mediaSlug: string;
  pitchAccent?: number;
  reading?: string;
};

type PitchAccentResult =
  | {
      entryId: string;
      kind: EntryKind;
      pitchAccent: number;
      sources: Record<PitchAccentSource, number>;
      status: "confirmed";
    }
  | {
      entryId: string;
      kind: EntryKind;
      ojad?: number;
      status: "conflict";
      wiktionary?: number;
    }
  | {
      entryId: string;
      kind: EntryKind;
      status:
        | "miss"
        | "skipped_existing"
        | "source_error";
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

const DEFAULT_REQUEST_DELAY_MS = 1200;
const DEFAULT_RETRY_BASE_DELAY_MS = 5000;
const DEFAULT_MAX_RETRIES = 4;

let nextAllowedNetworkRequestAt = 0;

export async function fetchPitchAccentsForBundle(input: {
  bundle: NormalizedMediaBundle;
  cacheRoot: string;
  dryRun?: boolean;
  limit?: number;
  network?: PronunciationFetchNetworkOptions;
  refresh?: boolean;
}) {
  const allTargets = collectPitchAccentTargets(input.bundle);
  const targets = allTargets.filter((entry) =>
    input.refresh ? true : entry.pitchAccent === undefined
  );
  const limitedTargets =
    typeof input.limit === "number" && input.limit >= 0
      ? targets.slice(0, input.limit)
      : targets;
  const manifestState = await loadPronunciationManifest(input.bundle.mediaDirectory);

  if (manifestState.issues.length > 0) {
    throw new Error(
      `Cannot update pitch accents for '${input.bundle.mediaSlug}' because pronunciations.json is invalid.`
    );
  }

  const manifestEntries = new Map<string, PronunciationManifestEntry>(
    (manifestState.manifest?.entries ?? []).map((entry) => [
      `${entry.entryType}:${entry.entryId}`,
      entry
    ])
  );
  const results: PitchAccentResult[] = [];

  for (const entry of limitedTargets) {
    const resolved = await resolvePitchAccentForEntry({
      cacheRoot: input.cacheRoot,
      entry,
      network: input.network
    });
    results.push(resolved);

    if (resolved.status !== "confirmed") {
      continue;
    }

    const manifestKey = `${entry.kind}:${entry.id}`;
    const manifestEntry =
      manifestEntries.get(manifestKey) ?? buildManifestEntryFromTarget(entry);

    if (!manifestEntry) {
      continue;
    }

    manifestEntries.set(manifestKey, {
      ...manifestEntry,
      pitchAccent: resolved.pitchAccent
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
    confirmed: results.filter((result) => result.status === "confirmed").length,
    conflicts: results.filter((result) => result.status === "conflict").length,
    missed: results.filter((result) => result.status === "miss").length,
    results,
    skipped: results.filter((result) =>
      result.status === "skipped_existing"
    ).length
  };
}

export async function resolvePitchAccentForEntry(input: {
  cacheRoot: string;
  entry: PitchAccentFetchTarget;
  network?: PronunciationFetchNetworkOptions;
}): Promise<PitchAccentResult> {
  try {
    const [wiktionary, ojad] = await Promise.all([
      lookupWiktionaryPitchAccent({
        cacheRoot: input.cacheRoot,
        entry: input.entry,
        network: input.network
      }),
      lookupOjadPitchAccent({
        cacheRoot: input.cacheRoot,
        entry: input.entry,
        network: input.network
      })
    ]);

    if (typeof wiktionary === "number" && typeof ojad === "number") {
      if (wiktionary === ojad) {
        return {
          entryId: input.entry.id,
          kind: input.entry.kind,
          pitchAccent: wiktionary,
          sources: {
            ojad,
            wiktionary
          },
          status: "confirmed"
        };
      }

      return {
        entryId: input.entry.id,
        kind: input.entry.kind,
        ojad,
        status: "conflict",
        wiktionary
      };
    }

    return {
      entryId: input.entry.id,
      kind: input.entry.kind,
      status: "miss"
    };
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : String(error),
      entryId: input.entry.id,
      kind: input.entry.kind,
      status: "source_error"
    };
  }
}

export async function lookupWiktionaryPitchAccent(input: {
  cacheRoot: string;
  entry: PitchAccentFetchTarget;
  network?: PronunciationFetchNetworkOptions;
}) {
  const candidates = new Set<number>();
  const variants = buildLookupVariants(input.entry);

  for (const host of ["en.wiktionary.org", "ja.wiktionary.org"] as const) {
    for (const title of variants) {
      const cacheKey = hashString(`pitch-wiktionary:${host}:${title}`);
      const response = await fetchJsonWithCache<{
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
          }>;
        };
      }>({
        cachePath: path.join(input.cacheRoot, "pitch-accent", "wiktionary", `${cacheKey}.json`),
        network: input.network,
        url: `https://${host}/w/api.php?action=query&format=json&formatversion=2&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(title)}`
      });
      const source =
        response.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? "";
      const values = extractPitchAccentFromWiktionaryWikitext(source, input.entry);

      for (const value of values) {
        candidates.add(value);
      }
    }
  }

  return candidates.size === 1 ? [...candidates][0] : null;
}

export async function lookupOjadPitchAccent(input: {
  cacheRoot: string;
  entry: PitchAccentFetchTarget;
  network?: PronunciationFetchNetworkOptions;
}) {
  const variants = buildLookupVariants(input.entry);
  let best: OjadCandidate | null = null;

  for (const query of variants) {
    const cacheKey = hashString(`pitch-ojad:${query}`);
    const html = await fetchTextWithCache({
      cachePath: path.join(input.cacheRoot, "pitch-accent", "ojad", `${cacheKey}.html`),
      network: input.network,
      url: `https://www.gavo.t.u-tokyo.ac.jp/ojad/search/index/word:${encodeURIComponent(query)}`
    });
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

  return best && best.score >= 120 ? best.pitchAccent : null;
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
    const title = stripHtml(row.match(/<p class="midashi_word">([\s\S]*?)<\/p>/iu)?.[1]);
    const accentCell = row.match(
      /<td class="katsuyo katsuyo_jisho_js">[\s\S]*?<\/td>/iu
    )?.[0];

    if (!title || !accentCell) {
      continue;
    }

    const spans = [...accentCell.matchAll(
      /<span class="([^"]+)"><span class="inner"><span class="char">([^<]+)<\/span>/giu
    )].map((match) => ({
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

function buildLookupVariants(entry: PitchAccentFetchTarget) {
  const variants = new Set<string>();

  for (const value of [entry.label, entry.reading, ...entry.aliases]) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();

    if (trimmed.length > 0) {
      variants.add(trimmed);
      variants.add(trimmed.replace(/^[～〜~]+/u, ""));
    }
  }

  return [...variants].filter((value) => value.length > 0);
}

function collectPitchAccentTargets(bundle: NormalizedMediaBundle) {
  return [
    ...bundle.terms.map((entry) => mapTermToPitchAccentTarget(bundle, entry)),
    ...bundle.grammarPatterns.map((entry) =>
      mapGrammarToPitchAccentTarget(bundle, entry)
    )
  ];
}

function mapTermToPitchAccentTarget(
  bundle: NormalizedMediaBundle,
  entry: NormalizedTerm
): PitchAccentFetchTarget {
  return {
    aliases: entry.aliases,
    audio: entry.audio,
    id: entry.id,
    kind: "term",
    label: entry.lemma,
    mediaDirectory: bundle.mediaDirectory,
    mediaSlug: bundle.mediaSlug,
    pitchAccent: entry.pitchAccent,
    reading: entry.reading
  };
}

function mapGrammarToPitchAccentTarget(
  bundle: NormalizedMediaBundle,
  entry: NormalizedGrammarPattern
): PitchAccentFetchTarget {
  return {
    aliases: entry.aliases,
    audio: entry.audio,
    id: entry.id,
    kind: "grammar",
    label: entry.pattern,
    mediaDirectory: bundle.mediaDirectory,
    mediaSlug: bundle.mediaSlug,
    pitchAccent: entry.pitchAccent,
    reading: entry.reading ?? entry.pattern
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
    pitchAccent: entry.pitchAccent
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
    .some(
      (candidate) => normalizePronunciationText(candidate) === normalized
    );
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

  if (normalizedReading.length > 0 && normalizedReading === normalizedEntryReading) {
    score += 220;
  }

  if (normalizedTitle === normalizedLabel || normalizedTitle.includes(normalizedLabel)) {
    score += 140;
  }

  if (
    normalizedEntryReading.length > 0 &&
    (normalizedTitle === normalizedEntryReading ||
      normalizedTitle.includes(normalizedEntryReading))
  ) {
    score += 100;
  }

  if (normalizedReading === normalizedQuery || normalizedTitle.includes(normalizedQuery)) {
    score += 60;
  }

  return score;
}

async function fetchJsonWithCache<T>(input: {
  cachePath: string;
  network?: PronunciationFetchNetworkOptions;
  url: string;
}) {
  const body = await fetchTextWithCache(input);
  return JSON.parse(body) as T;
}

async function fetchTextWithCache(input: {
  cachePath: string;
  network?: PronunciationFetchNetworkOptions;
  url: string;
}) {
  if (await fileExists(input.cachePath)) {
    return readFile(input.cachePath, "utf8");
  }

  await mkdir(path.dirname(input.cachePath), { recursive: true });
  const requestDelayMs = input.network?.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS;
  const retryBaseDelayMs =
    input.network?.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const maxRetries = input.network?.maxRetries ?? DEFAULT_MAX_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    await waitForNextNetworkSlot(requestDelayMs);

    const response = await fetch(input.url, {
      headers: {
        "User-Agent": "japanese-custom-study/0.1 pitch-accent fetcher"
      }
    });

    if (response.ok) {
      const body = await response.text();
      await writeFile(input.cachePath, body);
      return body;
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

function stripHtml(value: string | undefined) {
  if (!value) {
    return null;
  }

  const stripped = value.replace(/<[^>]+>/g, " ").replace(/\s+/gu, " ").trim();
  return stripped.length > 0 ? stripped : null;
}

function hashString(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
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
