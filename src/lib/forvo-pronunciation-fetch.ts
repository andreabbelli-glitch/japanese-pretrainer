import { createInterface } from "node:readline/promises";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import type { Socket } from "node:net";

import { chromium, type Download, type Page } from "@playwright/test";

import {
  loadPronunciationManifest,
  serializePronunciationManifest,
  type PronunciationManifestEntry
} from "./content/pronunciations-manifest.ts";
import type { NormalizedMediaBundle } from "./content/types.ts";
import { buildEntryKey } from "./entry-id.ts";
import {
  collectPronunciationTargets,
  normalizePronunciationText,
  type PronunciationTargetEntry
} from "./pronunciation-fetch.ts";

type WordListRequest = {
  entryId?: string;
  raw: string;
  reading?: string;
  word?: string;
};

export type ForvoBrowserOptions = {
  browserTimeoutMs?: number;
  entryDelayMs?: number;
  headless?: boolean;
  keepBrowserOpen?: boolean;
  knownMissingPath?: string;
  profileDir: string;
  retryKnownMissing?: boolean;
};

export type ForvoManualOptions = {
  controlPort?: number;
  downloadsDir: string;
  entryDelayMs?: number;
  knownMissingPath?: string;
  openUrls?: boolean;
  retryKnownMissing?: boolean;
};

type ForvoKnownMissingEntry = {
  entryId: string;
  entryKind: "term" | "grammar";
  label: string;
  mediaSlug: string;
  reading?: string;
  reason: "not_found_on_forvo";
  updatedAt: string;
};

type ForvoKnownMissingRegistry = {
  version: 1;
  entries: ForvoKnownMissingEntry[];
};

type SkipResolutionMode = "active" | "pending";

type ManualForvoCaptureResult =
  | {
      status: "downloaded";
      audioAttribution: string;
      audioLicense?: string;
      audioPageUrl: string;
      audioSpeaker?: string;
      audioSrc: string;
    }
  | {
      status: "skipped_known_missing";
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

const skipControlState: {
  currentSkipHandler: null | (() => void);
  pendingSkip: boolean;
  port: number | null;
  ready: Promise<string> | null;
  server: ReturnType<typeof createServer> | null;
  sockets: Set<Socket>;
} = {
  currentSkipHandler: null,
  pendingSkip: false,
  port: null,
  ready: null,
  server: null,
  sockets: new Set()
};

export async function fetchForvoPronunciationsForBundle(input: {
  browser: ForvoBrowserOptions;
  bundle: NormalizedMediaBundle;
  dryRun?: boolean;
  limit?: number;
  refresh?: boolean;
  wordListSource?: string;
  words?: string[];
  entryIds?: string[];
}) {
  const manifest = await loadPronunciationManifest(input.bundle.mediaDirectory);

  if (manifest.issues.length > 0) {
    throw new Error(
      `Cannot update pronunciations for '${input.bundle.mediaSlug}' because pronunciations.json is invalid.`
    );
  }

  const manifestEntries = new Map<string, PronunciationManifestEntry>(
    (manifest.manifest?.entries ?? []).map((entry) => [
      buildEntryKey(entry.entryType, entry.entryId),
      entry
    ])
  );
  const allTargets = collectPronunciationTargets(input.bundle);
  const isStillMissing = (entry: PronunciationTargetEntry) =>
    input.refresh ||
    !(
      entry.audioSrc ||
      manifestEntries.get(buildEntryKey(entry.kind, entry.id))?.audioSrc
    );
  const filteredTargets = allTargets.filter(isStillMissing);
  const hasExplicitRequests =
    (input.entryIds?.length ?? 0) > 0 ||
    (input.words?.length ?? 0) > 0 ||
    typeof input.wordListSource === "string";
  const requestedTargets = resolveRequestedTargets({
    bundle: input.bundle,
    entryIds: input.entryIds,
    refresh: input.refresh,
    wordListSource: input.wordListSource,
    words: input.words
  });
  const selectedTargets = (
    hasExplicitRequests ? requestedTargets.targets : filteredTargets
  ).filter(isStillMissing);
  const limitedTargets =
    typeof input.limit === "number" && input.limit >= 0
      ? selectedTargets.slice(0, input.limit)
      : selectedTargets;
  const knownMissingRegistry = await loadForvoKnownMissingRegistry(
    input.browser.knownMissingPath
  );
  const knownMissingPruned = pruneKnownMissingRegistry(
    knownMissingRegistry,
    allTargets,
    input.bundle.mediaSlug
  );
  if (knownMissingPruned && !input.dryRun) {
    await persistForvoKnownMissingRegistry(
      input.browser.knownMissingPath,
      knownMissingRegistry
    );
  }
  const knownMissingSkipped = input.browser.retryKnownMissing
    ? []
    : limitedTargets.filter((entry) =>
        hasKnownMissingForEntry(
          knownMissingRegistry,
          input.bundle.mediaSlug,
          entry
        )
      );
  const runnableTargets =
    knownMissingSkipped.length > 0
      ? limitedTargets.filter(
          (entry) =>
            !hasKnownMissingForEntry(
              knownMissingRegistry,
              input.bundle.mediaSlug,
              entry
            )
        )
      : limitedTargets;

  if (runnableTargets.length === 0) {
    return {
      matched: 0,
      missed: 0,
      knownMissingSkipped: knownMissingSkipped.map((entry) => ({
        entryId: entry.id,
        kind: entry.kind,
        status: "skipped_known_missing"
      })),
      requestedUnresolved: requestedTargets.unresolved,
      results: []
    };
  }

  const context = await chromium.launchPersistentContext(
    input.browser.profileDir,
    {
      acceptDownloads: true,
      channel: "chrome",
      headless: input.browser.headless ?? false
    }
  );
  const page = context.pages()[0] ?? (await context.newPage());
  const results = [];

  try {
    for (const [index, entry] of runnableTargets.entries()) {
      const resolved = await downloadForvoPronunciation({
        browserTimeoutMs: input.browser.browserTimeoutMs,
        dryRun: input.dryRun,
        entry,
        page
      });

      if (!resolved) {
        results.push({
          entryId: entry.id,
          kind: entry.kind,
          status: "miss"
        });
        continue;
      }

      manifestEntries.set(buildEntryKey(entry.kind, entry.id), {
        entryId: entry.id,
        entryType: entry.kind,
        audioAttribution: resolved.audioAttribution,
        audioLicense: resolved.audioLicense,
        audioPageUrl: resolved.audioPageUrl,
        audioSource: "forvo",
        audioSpeaker: resolved.audioSpeaker,
        audioSrc: resolved.audioSrc
      });

      if (!input.dryRun) {
        await persistPronunciationManifest(
          input.bundle.mediaDirectory,
          manifestEntries
        );
      }

      results.push({
        entryId: entry.id,
        kind: entry.kind,
        speaker: resolved.audioSpeaker,
        status: "matched",
        votes: resolved.votes
      });

      if (index < runnableTargets.length - 1) {
        await sleep(input.browser.entryDelayMs ?? 2500);
      }
    }
  } finally {
    if (!input.browser.keepBrowserOpen) {
      await context.close();
    }
  }

  return {
    matched: results.filter((result) => result.status === "matched").length,
    missed: results.filter((result) => result.status === "miss").length,
    knownMissingSkipped: knownMissingSkipped.map((entry) => ({
      entryId: entry.id,
      kind: entry.kind,
      status: "skipped_known_missing"
    })),
    requestedUnresolved: requestedTargets.unresolved,
    results
  };
}

export async function fetchForvoPronunciationsForBundleManual(input: {
  bundle: NormalizedMediaBundle;
  dryRun?: boolean;
  entryIds?: string[];
  limit?: number;
  manual: ForvoManualOptions;
  refresh?: boolean;
  wordListSource?: string;
  words?: string[];
}) {
  const manifest = await loadPronunciationManifest(input.bundle.mediaDirectory);

  if (manifest.issues.length > 0) {
    throw new Error(
      `Cannot update pronunciations for '${input.bundle.mediaSlug}' because pronunciations.json is invalid.`
    );
  }

  const manifestEntries = new Map<string, PronunciationManifestEntry>(
    (manifest.manifest?.entries ?? []).map((entry) => [
      buildEntryKey(entry.entryType, entry.entryId),
      entry
    ])
  );
  const allTargets = collectPronunciationTargets(input.bundle);
  const isStillMissing = (entry: PronunciationTargetEntry) =>
    input.refresh ||
    !(
      entry.audioSrc ||
      manifestEntries.get(buildEntryKey(entry.kind, entry.id))?.audioSrc
    );
  const filteredTargets = allTargets.filter(isStillMissing);
  const hasExplicitRequests =
    (input.entryIds?.length ?? 0) > 0 ||
    (input.words?.length ?? 0) > 0 ||
    typeof input.wordListSource === "string";
  const requestedTargets = resolveRequestedTargets({
    bundle: input.bundle,
    entryIds: input.entryIds,
    refresh: input.refresh,
    wordListSource: input.wordListSource,
    words: input.words
  });
  const selectedTargets = (
    hasExplicitRequests ? requestedTargets.targets : filteredTargets
  ).filter(isStillMissing);
  const limitedTargets =
    typeof input.limit === "number" && input.limit >= 0
      ? selectedTargets.slice(0, input.limit)
      : selectedTargets;
  const knownMissingRegistry = await loadForvoKnownMissingRegistry(
    input.manual.knownMissingPath
  );
  const knownMissingPruned = pruneKnownMissingRegistry(
    knownMissingRegistry,
    allTargets,
    input.bundle.mediaSlug
  );
  if (knownMissingPruned && !input.dryRun) {
    await persistForvoKnownMissingRegistry(
      input.manual.knownMissingPath,
      knownMissingRegistry
    );
  }
  const knownMissingSkipped = input.manual.retryKnownMissing
    ? []
    : limitedTargets.filter((entry) =>
        hasKnownMissingForEntry(
          knownMissingRegistry,
          input.bundle.mediaSlug,
          entry
        )
      );
  const runnableTargets =
    knownMissingSkipped.length > 0
      ? limitedTargets.filter(
          (entry) =>
            !hasKnownMissingForEntry(
              knownMissingRegistry,
              input.bundle.mediaSlug,
              entry
            )
        )
      : limitedTargets;

  if (runnableTargets.length === 0) {
    return {
      matched: 0,
      missed: 0,
      knownMissingSkipped: knownMissingSkipped.map((entry) => ({
        entryId: entry.id,
        kind: entry.kind,
        status: "skipped_known_missing"
      })),
      requestedUnresolved: requestedTargets.unresolved,
      results: []
    };
  }

  const results = [];

  try {
    for (const [index, entry] of runnableTargets.entries()) {
      const resolved = await captureManualForvoPronunciation({
        controlPort: input.manual.controlPort,
        downloadsDir: input.manual.downloadsDir,
        dryRun: input.dryRun,
        entry,
        knownMissingPath: input.manual.knownMissingPath,
        mediaSlug: input.bundle.mediaSlug,
        openUrl: input.manual.openUrls ?? true
      });

      if (!resolved) {
        results.push({
          entryId: entry.id,
          kind: entry.kind,
          status: "miss"
        });
        continue;
      }

      if (resolved.status === "skipped_known_missing") {
        addKnownMissingEntry(knownMissingRegistry, {
          entry,
          mediaSlug: input.bundle.mediaSlug
        });

        if (!input.dryRun) {
          await persistForvoKnownMissingRegistry(
            input.manual.knownMissingPath,
            knownMissingRegistry
          );
        }

        results.push({
          entryId: entry.id,
          kind: entry.kind,
          status: "skipped_known_missing"
        });
        continue;
      }

      manifestEntries.set(buildEntryKey(entry.kind, entry.id), {
        entryId: entry.id,
        entryType: entry.kind,
        audioAttribution: resolved.audioAttribution,
        audioLicense: resolved.audioLicense,
        audioPageUrl: resolved.audioPageUrl,
        audioSource: "forvo",
        audioSpeaker: resolved.audioSpeaker,
        audioSrc: resolved.audioSrc
      });

      if (!input.dryRun) {
        await persistPronunciationManifest(
          input.bundle.mediaDirectory,
          manifestEntries
        );
      }

      results.push({
        entryId: entry.id,
        kind: entry.kind,
        speaker: resolved.audioSpeaker,
        status: "matched"
      });

      if (index < runnableTargets.length - 1) {
        await sleep(input.manual.entryDelayMs ?? 2500);
      }
    }

    return {
      matched: results.filter((result) => result.status === "matched").length,
      missed: results.filter((result) => result.status === "miss").length,
      knownMissingSkipped: [
        ...knownMissingSkipped.map((entry) => ({
          entryId: entry.id,
          kind: entry.kind,
          status: "skipped_known_missing"
        })),
        ...results.filter((result) => result.status === "skipped_known_missing")
      ],
      requestedUnresolved: requestedTargets.unresolved,
      results
    };
  } finally {
    await closeSkipControlServer();
  }
}

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

async function downloadForvoPronunciation(input: {
  browserTimeoutMs?: number;
  dryRun?: boolean;
  entry: PronunciationTargetEntry;
  page: Page;
}) {
  const attempts = 2;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidates = await loadForvoCandidatesForEntry({
      browserTimeoutMs: input.browserTimeoutMs,
      entry: input.entry,
      page: input.page
    });
    const selected = selectBestForvoCandidate(candidates);

    if (!selected) {
      return null;
    }

    const pageUrl = input.page.url();
    const localAssetPath = buildForvoAudioAssetPath(input.entry, selected);

    if (input.dryRun) {
      return {
        audioAttribution: buildForvoAttribution(selected),
        audioLicense: undefined,
        audioPageUrl: pageUrl,
        audioSpeaker: selected.speaker,
        audioSrc: localAssetPath,
        votes: selected.votes
      };
    }

    const absoluteAssetPath = path.join(
      input.entry.mediaDirectory,
      localAssetPath.replace(/^assets\//u, "assets/")
    );

    await mkdir(path.dirname(absoluteAssetPath), { recursive: true });

    try {
      const download = await triggerForvoDownload(
        input.page,
        selected.candidateIndex
      );
      await download.saveAs(absoluteAssetPath);

      return {
        audioAttribution: buildForvoAttribution(selected),
        audioLicense: undefined,
        audioPageUrl: pageUrl,
        audioSpeaker: selected.speaker,
        audioSrc: localAssetPath,
        votes: selected.votes
      };
    } catch (error) {
      if (attempt + 1 >= attempts) {
        throw error;
      }

      await promptForManualIntervention(
        "Forvo did not start the download automatically. Complete login or Cloudflare verification in the opened browser, then press Enter to retry."
      );
    }
  }

  return null;
}

async function captureManualForvoPronunciation(input: {
  controlPort?: number;
  downloadsDir: string;
  dryRun?: boolean;
  entry: PronunciationTargetEntry;
  knownMissingPath?: string;
  mediaSlug: string;
  openUrl: boolean;
}): Promise<ManualForvoCaptureResult | null> {
  const forvoUrl = buildForvoWordUrls(input.entry)[0];
  const startedAt = Date.now();

  if (!forvoUrl) {
    return null;
  }

  console.info("");
  console.info(
    `Manual Forvo step for ${buildEntryKey(input.entry.kind, input.entry.id)}`
  );
  console.info(`  word: ${input.entry.label}`);
  if (input.entry.reading) {
    console.info(`  reading: ${input.entry.reading}`);
  }
  console.info(`  url: ${forvoUrl}`);

  if (input.openUrl) {
    await openUrlInDefaultBrowser(forvoUrl);
  }

  console.info(
    `  waiting for a new audio file in ${input.downloadsDir} to continue automatically`
  );
  console.info(
    "  type 's' then Enter to mark this entry missing on Forvo and skip it"
  );

  const outcome = await waitForManualDownloadOrSkip({
    afterMs: startedAt,
    controlPort: input.controlPort,
    downloadsDir: input.downloadsDir
  });

  if (outcome?.status === "skipped_known_missing") {
    return outcome;
  }

  const downloadedFile = outcome?.downloadedFile;

  if (!downloadedFile) {
    throw new Error(
      `No new audio download detected in ${input.downloadsDir} for '${input.entry.label}'.`
    );
  }

  if (!doesManualDownloadMatchEntry(downloadedFile, input.entry)) {
    throw new Error(
      `Detected '${path.basename(downloadedFile)}' while waiting for '${input.entry.label}', but the filename does not match the expected entry. The file was left in Downloads on purpose so it can be retried or inspected.`
    );
  }

  const extension = path.extname(downloadedFile).toLowerCase() || ".mp3";
  const safeLabel = slugifyForvoSegment(
    input.entry.reading ?? input.entry.label
  );
  const localAssetPath = `assets/audio/${input.entry.kind}/${input.entry.id}/forvo-manual-${safeLabel}${extension}`;

  if (!input.dryRun) {
    const absoluteAssetPath = path.join(
      input.entry.mediaDirectory,
      localAssetPath.replace(/^assets\//u, "assets/")
    );

    await mkdir(path.dirname(absoluteAssetPath), { recursive: true });
    await copyFile(downloadedFile, absoluteAssetPath);
  }

  return {
    status: "downloaded",
    audioAttribution: "Downloaded manually from Forvo",
    audioLicense: undefined,
    audioPageUrl: forvoUrl,
    audioSpeaker: undefined,
    audioSrc: localAssetPath
  };
}

async function loadForvoCandidatesForEntry(input: {
  browserTimeoutMs?: number;
  entry: PronunciationTargetEntry;
  page: Page;
}) {
  const timeoutMs = input.browserTimeoutMs ?? 45000;
  const wordUrls = buildForvoWordUrls(input.entry);

  for (const wordUrl of wordUrls) {
    await input.page.goto(wordUrl, {
      timeout: timeoutMs,
      waitUntil: "domcontentloaded"
    });
    await input.page.waitForTimeout(2500);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidates = await extractForvoCandidates(input.page, "ja");

      if (candidates.length > 0) {
        return candidates;
      }

      const bodyText = await safeReadBodyText(input.page);

      if (looksLikeChallengePage(bodyText) || looksLikeLoginGate(bodyText)) {
        await promptForManualIntervention(
          `Forvo needs manual verification for '${input.entry.label}'. Finish the page in the opened browser, then press Enter to continue.`
        );
        await input.page.waitForTimeout(1500);
        continue;
      }

      break;
    }
  }

  return [];
}

async function extractForvoCandidates(page: Page, languageCode: string) {
  return page.evaluate((lang) => {
    const attributeName = "data-codex-forvo-download";
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>("body *")
    );
    const isVisible = (element: HTMLElement) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width >= 0 &&
        rect.height >= 0
      );
    };
    const collectDownloadButtons = (root: ParentNode) =>
      Array.from(
        root.querySelectorAll<HTMLElement>("a, button, [role='button']")
      ).filter((element) => {
        const label = (element.innerText || element.textContent || "")
          .replace(/\s+/g, " ")
          .trim();

        return label === "Download MP3" && isVisible(element);
      });
    const findHeading = () =>
      elements.find((element) => {
        const text = (element.innerText || "").replace(/\s+/g, " ").trim();
        return (
          text.length > 0 &&
          text.length < 180 &&
          text.includes(`[${lang}]`) &&
          /pronunciation/iu.test(text)
        );
      }) ?? null;
    const heading = findHeading();
    let scopedButtons: HTMLElement[] = [];

    document
      .querySelectorAll<HTMLElement>(`[${attributeName}]`)
      .forEach((element) => element.removeAttribute(attributeName));

    if (heading) {
      for (
        let current: HTMLElement | null = heading;
        current;
        current = current.parentElement
      ) {
        const found = collectDownloadButtons(current);

        if (found.length > 0 && found.length <= 24) {
          scopedButtons = found;
          break;
        }
      }
    }

    if (scopedButtons.length === 0) {
      scopedButtons = collectDownloadButtons(document);
    }

    const candidates = scopedButtons.map((button, index) => {
      button.setAttribute(attributeName, String(index));

      let container: HTMLElement | null = button;

      while (container) {
        const text = (container.innerText || "").replace(/\s+/g, " ").trim();
        const pronunciationCount = (text.match(/Pronunciation by/giu) ?? [])
          .length;

        if (
          /Pronunciation by/iu.test(text) &&
          /Download MP3/iu.test(text) &&
          pronunciationCount <= 2
        ) {
          break;
        }

        container = container.parentElement;
      }

      const text = (
        container?.innerText ||
        button.parentElement?.innerText ||
        button.innerText ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim();
      const speakerMatch =
        text.match(
          /Pronunciation by\s+(.+?)\s+\((Male|Female)(?: from ([^)]+))?\)/iu
        ) ?? text.match(/Pronunciation by\s+(.+?)(?:\s{2,}|$)/iu);
      const votesMatch = text.match(/(-?\d+)\s+votes?\s+Good\s+Bad/iu);
      const accentMatch = text.match(
        /Accent:\s+(.+?)(?:\s{2,}|Pronunciation by|Download MP3|$)/iu
      );

      return {
        accent: accentMatch?.[1]?.trim(),
        candidateIndex: index,
        pageUrl: location.href,
        sectionIndex: index,
        speaker: speakerMatch?.[1]?.trim(),
        speakerCountry: speakerMatch?.[3]?.trim(),
        speakerGender: speakerMatch?.[2]?.trim(),
        text,
        votes:
          typeof votesMatch?.[1] === "string"
            ? Number.parseInt(votesMatch[1], 10)
            : undefined
      };
    });

    if (heading && scopedButtons.length > 0) {
      const headingRootText = (
        heading.parentElement?.innerText ||
        heading.innerText ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim();

      if (!headingRootText.includes(`[${lang}]`)) {
        return [];
      }
    }

    return candidates.filter((candidate) => candidate.text.length > 0);
  }, languageCode);
}

async function triggerForvoDownload(
  page: Page,
  candidateIndex: number
): Promise<Download> {
  const locator = page.locator(
    `[data-codex-forvo-download="${String(candidateIndex)}"]`
  );
  const downloadPromise = page.waitForEvent("download", {
    timeout: 12000
  });

  await locator.first().scrollIntoViewIfNeeded();
  await locator.first().click();

  return downloadPromise;
}

async function promptForManualIntervention(message: string) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      `${message} Interactive input is required, but this session is not attached to a TTY.`
    );
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    await readline.question(
      `${message}\nPress Enter when the browser is ready. `
    );
  } finally {
    closeInteractiveReadline(readline);
  }
}

function looksLikeChallengePage(bodyText: string) {
  return /security verification|just a moment|enable javascript and cookies/iu.test(
    bodyText
  );
}

function looksLikeLoginGate(bodyText: string) {
  return /\blog in\b|\bsign in\b/iu.test(bodyText) && /forvo/iu.test(bodyText);
}

async function safeReadBodyText(page: Page) {
  try {
    const body = page.locator("body");
    return (await body.innerText()).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

async function waitForManualDownloadOrSkip(input: {
  afterMs: number;
  controlPort?: number;
  downloadsDir: string;
}) {
  const timeoutAt = Date.now() + 5 * 60 * 1000;

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    while (Date.now() < timeoutAt) {
      const candidate = await findNewestCompletedAudioFile({
        afterMs: input.afterMs,
        downloadsDir: input.downloadsDir
      });

      if (candidate) {
        const stable = await waitForFileToStabilize(candidate);

        if (stable) {
          return {
            downloadedFile: candidate,
            status: "downloaded"
          } as const;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return null;
  }

  return await new Promise<
    | { downloadedFile: string; status: "downloaded" }
    | { status: "skipped_known_missing" }
    | null
  >((resolve) => {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    let resolved = false;

    const finish = (
      value:
        | { downloadedFile: string; status: "downloaded" }
        | { status: "skipped_known_missing" }
        | null
    ) => {
      if (resolved) {
        return;
      }

      resolved = true;
      clearInterval(interval);
      releaseSkipWaiter(skipHandler);
      closeInteractiveReadline(readline);
      resolve(value);
    };

    const skipHandler = () => finish({ status: "skipped_known_missing" });
    const skipReady = ensureSkipControlServer(input.controlPort ?? 3210);

    armSkipWaiter(skipHandler);

    if (skipControlState.pendingSkip) {
      skipControlState.pendingSkip = false;
      queueMicrotask(skipHandler);
    }

    skipReady
      .then((url) => {
        console.info(`  browser skip URL: ${url}`);
      })
      .catch((error) => {
        console.warn(`Skip control URL unavailable: ${String(error)}`);
      });

    readline.on("line", (line) => {
      const normalized = line.trim().toLowerCase();

      if (normalized === "s") {
        finish({ status: "skipped_known_missing" });
      }
    });

    const interval = setInterval(async () => {
      if (resolved) {
        return;
      }

      if (Date.now() >= timeoutAt) {
        finish(null);
        return;
      }

      try {
        const candidate = await findNewestCompletedAudioFile({
          afterMs: input.afterMs,
          downloadsDir: input.downloadsDir
        });

        if (!candidate) {
          return;
        }

        const stable = await waitForFileToStabilize(candidate);

        if (stable) {
          finish({
            downloadedFile: candidate,
            status: "downloaded"
          });
        }
      } catch {
        finish(null);
      }
    }, 1000);
  });
}

function closeInteractiveReadline(
  readline: ReturnType<typeof createInterface>
) {
  readline.close();

  if (process.stdin.isTTY) {
    process.stdin.pause();
  }
}

async function persistPronunciationManifest(
  mediaDirectory: string,
  manifestEntries: Map<string, PronunciationManifestEntry>
) {
  const manifestPath = path.join(mediaDirectory, "pronunciations.json");

  await writeFile(
    manifestPath,
    serializePronunciationManifest({
      entries: [...manifestEntries.values()],
      version: 1
    })
  );
}

async function loadForvoKnownMissingRegistry(filePath?: string) {
  if (!filePath) {
    return {
      entries: [],
      version: 1
    } satisfies ForvoKnownMissingRegistry;
  }

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ForvoKnownMissingRegistry>;

    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      version: 1
    } satisfies ForvoKnownMissingRegistry;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        entries: [],
        version: 1
      } satisfies ForvoKnownMissingRegistry;
    }

    throw error;
  }
}

async function persistForvoKnownMissingRegistry(
  filePath: string | undefined,
  registry: ForvoKnownMissingRegistry
) {
  if (!filePath) {
    return;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify(
      {
        version: 1,
        entries: registry.entries.sort((left, right) => {
          const mediaDelta = left.mediaSlug.localeCompare(right.mediaSlug);

          if (mediaDelta !== 0) {
            return mediaDelta;
          }

          const kindDelta = left.entryKind.localeCompare(right.entryKind);

          if (kindDelta !== 0) {
            return kindDelta;
          }

          return left.entryId.localeCompare(right.entryId);
        })
      },
      null,
      2
    )}\n`
  );
}

function hasKnownMissingForEntry(
  registry: ForvoKnownMissingRegistry,
  mediaSlug: string,
  entry: PronunciationTargetEntry
) {
  return registry.entries.some(
    (candidate) =>
      candidate.mediaSlug === mediaSlug &&
      candidate.entryKind === entry.kind &&
      candidate.entryId === entry.id
  );
}

function addKnownMissingEntry(
  registry: ForvoKnownMissingRegistry,
  input: {
    entry: PronunciationTargetEntry;
    mediaSlug: string;
  }
) {
  if (input.entry.audioSrc) {
    return;
  }

  if (hasKnownMissingForEntry(registry, input.mediaSlug, input.entry)) {
    return;
  }

  registry.entries.push({
    entryId: input.entry.id,
    entryKind: input.entry.kind,
    label: input.entry.label,
    mediaSlug: input.mediaSlug,
    reading: input.entry.reading,
    reason: "not_found_on_forvo",
    updatedAt: new Date().toISOString()
  });
}

function pruneKnownMissingRegistry(
  registry: ForvoKnownMissingRegistry,
  targets: PronunciationTargetEntry[],
  mediaSlug: string
) {
  const audioBacked = new Set(
    targets
      .filter((entry) => entry.mediaSlug === mediaSlug && entry.audioSrc)
      .map((entry) => buildEntryKey(entry.kind, entry.id))
  );
  const nextEntries = registry.entries.filter(
    (entry) =>
      entry.mediaSlug !== mediaSlug ||
      !audioBacked.has(buildEntryKey(entry.entryKind, entry.entryId))
  );

  if (nextEntries.length === registry.entries.length) {
    return false;
  }

  registry.entries = nextEntries;
  return true;
}

async function findNewestCompletedAudioFile(input: {
  afterMs: number;
  downloadsDir: string;
}) {
  const entries = await readdir(input.downloadsDir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const absolutePath = path.join(input.downloadsDir, entry.name);
        const metadata = await stat(absolutePath);

        return {
          absolutePath,
          mtimeMs: metadata.mtimeMs,
          size: metadata.size
        };
      })
  );

  return files
    .filter((file) => {
      const extension = path.extname(file.absolutePath).toLowerCase();

      return (
        file.mtimeMs >= input.afterMs &&
        file.size > 0 &&
        isCompletedDownload(file.absolutePath) &&
        [".mp3", ".ogg", ".oga", ".wav", ".m4a"].includes(extension)
      );
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.absolutePath;
}

function isCompletedDownload(filePath: string) {
  return !/\.crdownload$|\.download$|\.part$/iu.test(filePath);
}

async function sleep(durationMs: number) {
  if (durationMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, durationMs));
}

function ensureSkipControlServer(port: number) {
  if (
    skipControlState.server &&
    skipControlState.ready &&
    skipControlState.port === port
  ) {
    return skipControlState.ready;
  }

  const server = createServer((request, response) => {
    if (request.url?.startsWith("/skip")) {
      const mode = triggerSkipResolution();
      response.writeHead(200, {
        "Connection": "close",
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(
        mode === "active"
          ? "<!doctype html><title>Skipped</title><body>Current entry marked as missing on Forvo. You can close this tab.<script>window.close()</script></body>"
          : "<!doctype html><title>Skip Armed</title><body>Skip armed for the next active entry. You can close this tab.<script>window.close()</script></body>"
      );
      return;
    }

    response.writeHead(200, {
      "Connection": "close",
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end(
      "Forvo batch control is running.\nUse /skip to mark the current entry as missing.\n"
    );
  });

  server.on("connection", (socket) => {
    skipControlState.sockets.add(socket);
    socket.on("close", () => {
      skipControlState.sockets.delete(socket);
    });
  });

  const ready = new Promise<string>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(`http://127.0.0.1:${port}/skip`);
    });
  });

  skipControlState.port = port;
  skipControlState.ready = ready;
  skipControlState.server = server;

  return ready;
}

async function closeSkipControlServer() {
  const server = skipControlState.server;
  const sockets = [...skipControlState.sockets];

  skipControlState.currentSkipHandler = null;
  skipControlState.pendingSkip = false;
  skipControlState.port = null;
  skipControlState.ready = null;
  skipControlState.server = null;
  skipControlState.sockets = new Set();

  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    for (const socket of sockets) {
      socket.destroy();
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function armSkipWaiter(onSkip: () => void) {
  skipControlState.currentSkipHandler = onSkip;
}

function releaseSkipWaiter(onSkip: () => void) {
  if (skipControlState.currentSkipHandler === onSkip) {
    skipControlState.currentSkipHandler = null;
  }
}

function triggerSkipResolution(): SkipResolutionMode {
  if (skipControlState.currentSkipHandler) {
    const handler = skipControlState.currentSkipHandler;
    skipControlState.currentSkipHandler = null;
    handler();
    return "active";
  }

  skipControlState.pendingSkip = true;
  return "pending";
}

async function waitForFileToStabilize(filePath: string) {
  let previousSize = -1;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const metadata = await stat(filePath);

    if (metadata.size > 0 && metadata.size === previousSize) {
      return true;
    }

    previousSize = metadata.size;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  return false;
}

function buildForvoWordUrls(entry: PronunciationTargetEntry) {
  return [
    ...new Set(
      [entry.label, entry.reading, ...entry.aliases].filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0
      )
    )
  ].map((query) => `https://forvo.com/word/${encodeURIComponent(query)}/#ja`);
}

async function openUrlInDefaultBrowser(url: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("open", [url], {
      stdio: "ignore"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(`Failed to open browser URL ${url} (exit ${code ?? -1}).`)
      );
    });
  });
}

function buildForvoAudioAssetPath(
  entry: PronunciationTargetEntry,
  candidate: ForvoCandidate
) {
  const speakerSegment = slugifyForvoSegment(candidate.speaker ?? "forvo");
  const labelSegment = slugifyForvoSegment(entry.reading ?? entry.label);

  return `assets/audio/${entry.kind}/${entry.id}/forvo-${speakerSegment}-${labelSegment}.mp3`;
}

function buildForvoAttribution(candidate: ForvoCandidate) {
  if (candidate.speaker) {
    return `${candidate.speaker} via Forvo`;
  }

  return "Forvo";
}

function doesManualDownloadMatchEntry(
  downloadedFile: string,
  entry: PronunciationTargetEntry
) {
  const basename = path.basename(downloadedFile, path.extname(downloadedFile));
  const normalizedFilename = normalizePronunciationText(
    basename
      .replace(/^pronunciation[_-]?ja[_-]?/iu, "")
      .replace(/\(\d+\)$/u, "")
      .trim()
  );
  const acceptableTargets = new Set(
    [entry.label, entry.reading, ...entry.aliases]
      .filter((value): value is string => typeof value === "string")
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

function slugifyForvoSegment(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized.length > 0 ? normalized : "audio";
}
