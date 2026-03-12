import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import {
  loadPronunciationManifest,
  serializePronunciationManifest,
  type PronunciationManifestEntry
} from "./content/pronunciations-manifest.ts";
import { isSupportedAudioAssetPath } from "./media-assets.ts";
import type {
  NormalizedGrammarPattern,
  NormalizedMediaBundle,
  NormalizedTerm
} from "./content/types.ts";

type EntryKind = "term" | "grammar";

export type PronunciationFetchNetworkOptions = {
  maxRetries?: number;
  requestDelayMs?: number;
  requestTimeoutMs?: number;
  retryBaseDelayMs?: number;
};

const DEFAULT_REQUEST_DELAY_MS = 1200;
const DEFAULT_RETRY_BASE_DELAY_MS = 5000;
const DEFAULT_MAX_RETRIES = 4;

let nextAllowedNetworkRequestAt = 0;

export type PronunciationTargetEntry = {
  aliases: string[];
  audioSrc?: string;
  id: string;
  kind: EntryKind;
  label: string;
  mediaDirectory: string;
  mediaSlug: string;
  reading?: string;
};

export type PronunciationCandidate = {
  attribution?: string;
  fileTitle: string;
  fileUrl: string;
  license?: string;
  mimeType?: string;
  pageUrl: string;
  source: "lingua_libre" | "wikimedia_commons";
  speaker?: string;
  spokenText?: string;
};

type CommonsSearchResponse = {
  query?: {
    pages?: Array<{
      imageinfo?: Array<{
        descriptionurl?: string;
        extmetadata?: Record<string, { value?: string }>;
        mime?: string;
        url?: string;
      }>;
      title?: string;
    }>;
  };
};

type CommonsPage = NonNullable<
  NonNullable<CommonsSearchResponse["query"]>["pages"]
>[number];

type WiktionaryResponse = {
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
};

type WiktionaryCommonsReference = {
  fileTitle: string;
  spokenTextHint: string;
};

const WIKTIONARY_HOSTS = ["en.wiktionary.org", "ja.wiktionary.org"] as const;

export async function fetchPronunciationsForBundle(input: {
  bundle: NormalizedMediaBundle;
  cacheRoot: string;
  dryRun?: boolean;
  limit?: number;
  network?: PronunciationFetchNetworkOptions;
  refresh?: boolean;
}) {
  const entries = collectPronunciationTargets(input.bundle).filter(
    (entry) => !entry.audioSrc || input.refresh
  );
  const limitedEntries =
    typeof input.limit === "number" && input.limit >= 0
      ? entries.slice(0, input.limit)
      : entries;
  const manifest = await loadPronunciationManifest(input.bundle.mediaDirectory);

  if (manifest.issues.length > 0) {
    throw new Error(
      `Cannot update pronunciations for '${input.bundle.mediaSlug}' because pronunciations.json is invalid.`
    );
  }

  const manifestEntries = new Map<string, PronunciationManifestEntry>(
    (manifest.manifest?.entries ?? []).map((entry) => [
      `${entry.entryType}:${entry.entryId}`,
      entry
    ])
  );
  const results = [];

  for (const entry of limitedEntries) {
    const resolved = await resolvePronunciationForEntry({
      cacheRoot: input.cacheRoot,
      entry,
      network: input.network
    });

    if (!resolved) {
      results.push({
        entryId: entry.id,
        kind: entry.kind,
        status: "miss"
      });
      continue;
    }

    const localAsset = buildLocalAudioAssetPath(entry, resolved.candidate.fileTitle);
    const absoluteAssetPath = path.join(
      entry.mediaDirectory,
      localAsset.replace(/^assets\//, "assets/")
    );

    if (!input.dryRun) {
      await mkdir(path.dirname(absoluteAssetPath), { recursive: true });

      if (input.refresh || !(await fileExists(absoluteAssetPath))) {
        const response = await fetch(resolved.candidate.fileUrl);

        if (!response.ok) {
          throw new Error(
            `Failed to download ${resolved.candidate.fileUrl}: ${response.status} ${response.statusText}`
          );
        }

        const fileBuffer = Buffer.from(await response.arrayBuffer());
        await writeFile(absoluteAssetPath, fileBuffer);
      }
    }

    manifestEntries.set(`${entry.kind}:${entry.id}`, {
      entryId: entry.id,
      entryType: entry.kind,
      audioSrc: localAsset,
      audioSource: resolved.candidate.source,
      audioSpeaker: resolved.candidate.speaker,
      audioLicense: resolved.candidate.license,
      audioAttribution: resolved.candidate.attribution,
      audioPageUrl: resolved.candidate.pageUrl
    });
    results.push({
      entryId: entry.id,
      fileTitle: resolved.candidate.fileTitle,
      kind: entry.kind,
      status: "matched"
    });
  }

  if (!input.dryRun) {
    const manifestPath = path.join(
      input.bundle.mediaDirectory,
      "pronunciations.json"
    );
    await writeFile(
      manifestPath,
      serializePronunciationManifest({
        entries: [...manifestEntries.values()],
        version: 1
      })
    );
  }

  return {
    matched: results.filter((result) => result.status === "matched").length,
    missed: results.filter((result) => result.status === "miss").length,
    results
  };
}

export async function resolvePronunciationForEntry(input: {
  cacheRoot: string;
  entry: PronunciationTargetEntry;
  network?: PronunciationFetchNetworkOptions;
}) {
  const commonsCandidates = await searchCommonsCandidates({
    cacheRoot: input.cacheRoot,
    entry: input.entry,
    network: input.network
  });
  const wiktionaryTitles = await getWiktionaryCommonsFileTitles({
    cacheRoot: input.cacheRoot,
    entry: input.entry,
    network: input.network
  });
  const wiktionaryCandidates =
    wiktionaryTitles.length > 0
      ? await lookupCommonsFiles({
          cacheRoot: input.cacheRoot,
          network: input.network,
          references: wiktionaryTitles
        })
      : [];
  const candidates = dedupeCandidates([
    ...commonsCandidates,
    ...wiktionaryCandidates
  ]);
  const selected = selectBestPronunciationCandidate(input.entry, candidates);

  return selected ? { candidate: selected } : null;
}

export function collectPronunciationTargets(bundle: NormalizedMediaBundle) {
  return [
    ...bundle.terms.map((entry) => mapTermToPronunciationTarget(bundle, entry)),
    ...bundle.grammarPatterns.map((entry) =>
      mapGrammarToPronunciationTarget(bundle, entry)
    )
  ];
}

export function selectBestPronunciationCandidate(
  entry: PronunciationTargetEntry,
  candidates: PronunciationCandidate[]
) {
  const scoredCandidates = candidates
    .map((candidate) => ({
      candidate,
      score: scorePronunciationCandidate(entry, candidate)
    }))
    .filter((candidate) => candidate.score >= 140)
    .sort((left, right) => right.score - left.score);

  return scoredCandidates[0]?.candidate ?? null;
}

export function scorePronunciationCandidate(
  entry: PronunciationTargetEntry,
  candidate: PronunciationCandidate
) {
  if (
    !isSupportedAudioAssetPath(candidate.fileTitle) ||
    !isSupportedPronunciationMimeType(candidate.mimeType)
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  const targets = buildSearchTargets(entry);
  const spokenText = normalizePronunciationText(
    candidate.spokenText ?? candidate.fileTitle
  );

  if (!targets.has(spokenText)) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = candidate.source === "lingua_libre" ? 180 : 140;

  if (entry.reading && spokenText === normalizePronunciationText(entry.reading)) {
    score += 40;
  } else if (
    spokenText === normalizePronunciationText(entry.label) ||
    entry.aliases.some(
      (alias) => normalizePronunciationText(alias) === spokenText
    )
  ) {
    score += 24;
  }

  if (candidate.speaker) {
    score += 12;
  }

  if (candidate.license) {
    score += 10;
  }

  if (candidate.pageUrl) {
    score += 8;
  }

  return score;
}

export function normalizePronunciationText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/^file:/i, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[～〜~\s/|・._-]+/g, "")
    .toLowerCase();
}

export function extractSpokenTextFromCommonsTitle(title: string) {
  const bareTitle = title.replace(/^File:/i, "").replace(/\.[a-z0-9]+$/i, "");
  const linguaLibreMatch = bareTitle.match(/^LL-Q188 \(jpn\)-.+-(.+)$/u);

  if (linguaLibreMatch?.[1]) {
    return linguaLibreMatch[1];
  }

  const jaPrefixMatch = bareTitle.match(/^Ja[-_ ](.+)$/iu);

  if (jaPrefixMatch?.[1]) {
    return jaPrefixMatch[1];
  }

  return bareTitle;
}

export function extractCommonsFileTitlesFromWiktionaryWikitext(source: string) {
  const matches = new Set<string>();
  const patterns = [
    /\{\{audio\|[^|]+\|([^|}]+\.(?:mp3|ogg|oga|wav|m4a))[^}]*\}\}/giu,
    /\[\[(?:File|Image):([^|\]]+\.(?:mp3|ogg|oga|wav|m4a))/giu,
    /\{\{ja-pron\|[^{}]*\|a=([^|}]+\.(?:mp3|ogg|oga|wav|m4a))/giu
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const fileName = match[1]?.trim();

      if (fileName) {
        matches.add(fileName.startsWith("File:") ? fileName : `File:${fileName}`);
      }
    }
  }

  return [...matches];
}

async function searchCommonsCandidates(input: {
  cacheRoot: string;
  entry: PronunciationTargetEntry;
  network?: PronunciationFetchNetworkOptions;
}) {
  const variants = buildSearchVariants(input.entry);
  const candidates: PronunciationCandidate[] = [];

  for (const variant of variants) {
    const pages = await fetchCommonsSearch({
      cacheRoot: input.cacheRoot,
      query: `intitle:"${variant}"`,
      limit: 12,
      network: input.network
    });

    for (const page of pages) {
      const candidate = mapCommonsPageToCandidate(page);

      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

async function getWiktionaryCommonsFileTitles(input: {
  cacheRoot: string;
  entry: PronunciationTargetEntry;
  network?: PronunciationFetchNetworkOptions;
}) {
  const titles = new Map<string, string>();
  const lookupTitles = [
    ...new Set(
      [input.entry.label, input.entry.reading].filter(
        (value): value is string => typeof value === "string"
      )
    )
  ];

  for (const title of lookupTitles) {
    for (const host of WIKTIONARY_HOSTS) {
      try {
        const cacheKey = hashString(`wiktionary:${host}:${title}`);
        const cachePath = path.join(
          input.cacheRoot,
          "wiktionary",
          `${cacheKey}.json`
        );
        const response = await fetchJsonWithCache<WiktionaryResponse>({
          cachePath,
          network: input.network,
          url: `https://${host}/w/api.php?action=query&format=json&formatversion=2&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(title)}`
        });
        const source =
          response.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? "";

        for (const fileTitle of extractCommonsFileTitlesFromWiktionaryWikitext(source)) {
          titles.set(fileTitle, title);
        }
      } catch (error) {
        console.warn(
          `Skipping ${host} lookup for '${title}': ${formatErrorMessage(error)}`
        );
      }
    }
  }

  return [...titles.entries()].map(
    ([fileTitle, spokenTextHint]): WiktionaryCommonsReference => ({
      fileTitle,
      spokenTextHint
    })
  );
}

async function lookupCommonsFiles(input: {
  cacheRoot: string;
  network?: PronunciationFetchNetworkOptions;
  references: WiktionaryCommonsReference[];
}) {
  const results: PronunciationCandidate[] = [];

  for (const reference of input.references) {
    const title = reference.fileTitle;
    const normalizedTitle = title.startsWith("File:") ? title : `File:${title}`;
    const cacheKey = hashString(`commons-file:${normalizedTitle}`);
    const cachePath = path.join(
      input.cacheRoot,
      "commons-files",
      `${cacheKey}.json`
    );
    const response = await fetchJsonWithCache<CommonsSearchResponse>({
      cachePath,
      network: input.network,
      url: `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&titles=${encodeURIComponent(normalizedTitle)}&prop=imageinfo&iiprop=url|mime|extmetadata`
    });
    const candidate = mapCommonsPageToCandidate(response.query?.pages?.[0], {
      spokenTextHint: reference.spokenTextHint
    });

    if (candidate) {
      results.push(candidate);
    }
  }

  return results;
}

async function fetchCommonsSearch(input: {
  cacheRoot: string;
  limit: number;
  network?: PronunciationFetchNetworkOptions;
  query: string;
}) {
  const cacheKey = hashString(`commons-search:${input.query}:${input.limit}`);
  const cachePath = path.join(input.cacheRoot, "commons-search", `${cacheKey}.json`);
  const response = await fetchJsonWithCache<CommonsSearchResponse>({
    cachePath,
    network: input.network,
    url: `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&generator=search&gsrnamespace=6&gsrlimit=${input.limit}&gsrsearch=${encodeURIComponent(input.query)}&prop=imageinfo&iiprop=url|mime|extmetadata`
  });

  return response.query?.pages ?? [];
}

function mapCommonsPageToCandidate(
  page: CommonsPage | undefined,
  overrides?: {
    spokenTextHint?: string;
  }
) {
  const title = page?.title;
  const imageInfo = page?.imageinfo?.[0];
  const fileUrl = imageInfo?.url;
  const pageUrl = imageInfo?.descriptionurl;

  if (!title || !fileUrl || !pageUrl) {
    return null;
  }

  const mimeType = imageInfo?.mime?.toLowerCase() ?? "";

  if (
    !isSupportedAudioAssetPath(title) ||
    !isSupportedPronunciationMimeType(mimeType)
  ) {
    return null;
  }

  const source = /^File:LL-Q188 \(jpn\)-/u.test(title)
    ? "lingua_libre"
    : "wikimedia_commons";

  return {
    attribution:
      sanitizeCommonsMetadata(imageInfo.extmetadata?.Credit?.value) ??
      sanitizeCommonsMetadata(imageInfo.extmetadata?.Attribution?.value),
    fileTitle: title,
    fileUrl,
    license: sanitizeCommonsMetadata(imageInfo.extmetadata?.LicenseShortName?.value),
    mimeType: imageInfo.mime,
    pageUrl,
    source,
    speaker:
      sanitizeCommonsMetadata(imageInfo.extmetadata?.Artist?.value) ??
      parseSpeakerFromLinguaLibreTitle(title),
    spokenText:
      overrides?.spokenTextHint ?? extractSpokenTextFromCommonsTitle(title)
  } satisfies PronunciationCandidate;
}

function dedupeCandidates(candidates: PronunciationCandidate[]) {
  const byTitle = new Map<string, PronunciationCandidate>();

  for (const candidate of candidates) {
    byTitle.set(candidate.fileTitle, candidate);
  }

  return [...byTitle.values()];
}

function isSupportedPronunciationMimeType(mimeType?: string) {
  if (!mimeType || mimeType.trim().length === 0) {
    return true;
  }

  const normalized = mimeType.toLowerCase();

  return (
    normalized.startsWith("audio/") ||
    normalized === "application/ogg" ||
    normalized === "application/x-ogg"
  );
}

function buildSearchTargets(entry: PronunciationTargetEntry) {
  return new Set(
    [entry.label, entry.reading, ...entry.aliases]
      .filter((value): value is string => typeof value === "string")
      .map(normalizePronunciationText)
      .filter(Boolean)
  );
}

function buildSearchVariants(entry: PronunciationTargetEntry) {
  return [...buildSearchTargets(entry)]
    .map((value) =>
      [entry.reading, entry.label, ...entry.aliases]
        .filter((candidate): candidate is string => typeof candidate === "string")
        .find(
        (candidate) => normalizePronunciationText(candidate) === value
        )
    )
    .filter((value): value is string => typeof value === "string")
    .filter((value) => value.length > 0);
}

function buildLocalAudioAssetPath(
  entry: PronunciationTargetEntry,
  fileTitle: string
) {
  const extension = path.extname(fileTitle).toLowerCase() || ".ogg";
  const safeBaseName = slugifyFileSegment(
    path.basename(fileTitle, extension).replace(/^File:/i, "")
  );

  return `assets/audio/${entry.kind}/${entry.id}/${safeBaseName}${extension}`;
}

function mapTermToPronunciationTarget(
  bundle: NormalizedMediaBundle,
  entry: NormalizedTerm
): PronunciationTargetEntry {
  return {
    aliases: entry.aliases,
    audioSrc: entry.audio?.audioSrc,
    id: entry.id,
    kind: "term",
    label: entry.lemma,
    mediaDirectory: bundle.mediaDirectory,
    mediaSlug: bundle.mediaSlug,
    reading: entry.reading
  };
}

function mapGrammarToPronunciationTarget(
  bundle: NormalizedMediaBundle,
  entry: NormalizedGrammarPattern
): PronunciationTargetEntry {
  return {
    aliases: entry.aliases,
    audioSrc: entry.audio?.audioSrc,
    id: entry.id,
    kind: "grammar",
    label: entry.pattern,
    mediaDirectory: bundle.mediaDirectory,
    mediaSlug: bundle.mediaSlug,
    reading: entry.reading
  };
}

async function fetchJsonWithCache<T>(input: {
  cachePath: string;
  network?: PronunciationFetchNetworkOptions;
  url: string;
}): Promise<T> {
  if (await fileExists(input.cachePath)) {
    const cached = await readFile(input.cachePath, "utf8");
    return JSON.parse(cached) as T;
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
        "User-Agent": "japanese-custom-study/0.1 local pronunciation fetcher"
      }
    });

    if (response.ok) {
      const body = await response.text();
      await writeFile(input.cachePath, body);
      return JSON.parse(body) as T;
    }

    if (
      (response.status === 429 || response.status >= 500) &&
      attempt < maxRetries
    ) {
      const retryDelayMs =
        parseRetryAfterMs(response.headers.get("retry-after")) ??
        retryBaseDelayMs * 2 ** attempt;

      console.warn(
        `Retrying ${input.url} after ${retryDelayMs}ms (${response.status} ${response.statusText})`
      );
      await sleep(retryDelayMs);
      continue;
    }

    throw new Error(
      `Failed to fetch ${input.url}: ${response.status} ${response.statusText}`
    );
  }

  throw new Error(`Failed to fetch ${input.url}: exhausted retries`);
}

function sanitizeCommonsMetadata(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || undefined;
}

function parseSpeakerFromLinguaLibreTitle(title: string) {
  const match = title.match(/^File:LL-Q188 \(jpn\)-(.+)-.+$/u);
  return match?.[1];
}

function slugifyFileSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function hashString(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

export function parseRetryAfterMs(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const asSeconds = Number.parseInt(trimmed, 10);

  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const retryAt = Date.parse(trimmed);

  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(0, retryAt - Date.now());
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
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
