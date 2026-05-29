import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { buildEntryKey } from "../src/lib/entry-id.ts";
import { parseContentRoot } from "../src/features/content/validator.ts";
import {
  loadValidatedManifest,
  mergePronunciationAudioManifestEntry,
  persistManifestEntries
} from "../src/lib/manifest-helpers.ts";
import {
  loadForvoKnownMissingRegistry,
  persistForvoKnownMissingRegistry
} from "../src/lib/forvo-known-missing.ts";
import {
  loadForvoWordAddRequestRegistry,
  persistForvoWordAddRequestRegistry
} from "../src/lib/forvo-word-add.ts";
import { slugifyForvoSegment } from "../src/lib/forvo-pronunciation-helpers.ts";
import { collectPronunciationTargets } from "../src/lib/pronunciation-shared.ts";
import { writeBundlePronunciationPendingSummary } from "../src/lib/pronunciation-workflow.ts";
import type { PronunciationTargetEntry } from "../src/lib/pronunciation-shared.ts";

type CliOptions = {
  audioIndexPath: string;
  contentRoot: string;
  dryRun: boolean;
  knownMissingPath: string;
  limit?: number;
  refresh: boolean;
  requestRegistryPath: string;
};

type AudioCandidate = {
  decodedPath?: string;
  format?: string;
  source?: string;
  url?: string;
};

type AudioIndexEntry = {
  entryId: string;
  entryKind: "grammar" | "term";
  forvoWord?: string;
  forvoWordUrl?: string;
  mediaSlug: string;
  pageUrl?: string;
  reading?: string;
  selected?: {
    audioCandidates?: AudioCandidate[];
    speaker?: string;
    votes?: number;
  } | null;
  status?: string;
};

const options = parseCliOptions(process.argv.slice(2));
const contentRoot = path.resolve(options.contentRoot);
const audioIndex = await loadAudioIndex(path.resolve(options.audioIndexPath));
const parseResult = await parseContentRoot(contentRoot);

if (!parseResult.ok) {
  console.error("Content validation failed. Fix these issues first:");

  for (const issue of parseResult.issues) {
    console.error(
      `- [${issue.category}] ${issue.code} at ${issue.location.filePath}: ${issue.message}`
    );
  }

  process.exitCode = 1;
} else {
  const bundles = parseResult.data.bundles;
  const bundleBySlug = new Map(
    bundles.map((bundle) => [bundle.mediaSlug, bundle])
  );
  const targetByKey = new Map<string, PronunciationTargetEntry>();

  for (const bundle of bundles) {
    for (const target of collectPronunciationTargets(bundle)) {
      targetByKey.set(
        buildScopedEntryKey(bundle.mediaSlug, target.kind, target.id),
        target
      );
    }
  }

  const candidates = audioIndex.entries.filter(
    (entry) => entry.status === "audio_found" && entry.selected
  );
  const selectedEntries =
    typeof options.limit === "number"
      ? candidates.slice(0, options.limit)
      : candidates;
  const knownMissingRegistry = await loadForvoKnownMissingRegistry(
    path.resolve(options.knownMissingPath)
  );
  const requestRegistry = await loadForvoWordAddRequestRegistry(
    path.resolve(options.requestRegistryPath)
  );
  const manifestByMediaSlug = new Map<
    string,
    Awaited<ReturnType<typeof loadValidatedManifest>>["entries"]
  >();
  const touchedMediaSlugs = new Set<string>();
  const results: Array<{
    audioSrc?: string;
    entryId: string;
    entryKind: "grammar" | "term";
    mediaSlug: string;
    speaker?: string;
    status: "downloaded" | "missing_target" | "skipped_existing";
  }> = [];

  for (const entry of selectedEntries) {
    const target = targetByKey.get(
      buildScopedEntryKey(entry.mediaSlug, entry.entryKind, entry.entryId)
    );

    if (!target) {
      results.push({
        entryId: entry.entryId,
        entryKind: entry.entryKind,
        mediaSlug: entry.mediaSlug,
        status: "missing_target"
      });
      continue;
    }

    const manifestEntries = await getManifestEntries({
      manifestByMediaSlug,
      mediaSlug: entry.mediaSlug
    });
    const entryKey = buildEntryKey(entry.entryKind, entry.entryId);
    const existing = manifestEntries.get(entryKey);

    if (!options.refresh && (target.audioSrc || existing?.audioSrc)) {
      results.push({
        audioSrc: target.audioSrc ?? existing?.audioSrc,
        entryId: entry.entryId,
        entryKind: entry.entryKind,
        mediaSlug: entry.mediaSlug,
        speaker: existing?.audioSpeaker,
        status: "skipped_existing"
      });
      continue;
    }

    const speaker = entry.selected?.speaker;
    const audioSrc = buildImportedForvoAudioPath({ entry, speaker, target });

    if (!options.dryRun) {
      const absoluteTargetPath = path.join(target.mediaDirectory, audioSrc);

      await downloadAndStoreAudio({
        candidates: entry.selected?.audioCandidates ?? [],
        pageUrl: entry.pageUrl ?? entry.forvoWordUrl,
        targetPath: absoluteTargetPath
      });
    }

    manifestEntries.set(
      entryKey,
      mergePronunciationAudioManifestEntry({
        audio: {
          audioAttribution: speaker ? `${speaker} via Forvo` : "Forvo",
          audioPageUrl: entry.pageUrl ?? entry.forvoWordUrl,
          audioSource: "forvo",
          audioSpeaker: speaker,
          audioSrc
        },
        entryId: entry.entryId,
        entryType: entry.entryKind,
        existing
      })
    );

    markRequestResolved({
      audioSrc,
      entry,
      requestRegistry
    });
    removeKnownMissingEntry({
      entry,
      knownMissingRegistry
    });
    touchedMediaSlugs.add(entry.mediaSlug);
    results.push({
      audioSrc,
      entryId: entry.entryId,
      entryKind: entry.entryKind,
      mediaSlug: entry.mediaSlug,
      speaker,
      status: "downloaded"
    });
  }

  if (!options.dryRun) {
    for (const mediaSlug of touchedMediaSlugs) {
      const bundle = bundleBySlug.get(mediaSlug);
      const manifestEntries = manifestByMediaSlug.get(mediaSlug);

      if (!bundle || !manifestEntries) {
        continue;
      }

      await persistManifestEntries(bundle.mediaDirectory, manifestEntries);
    }

    await persistForvoKnownMissingRegistry(
      path.resolve(options.knownMissingPath),
      knownMissingRegistry
    );
    await persistForvoWordAddRequestRegistry(
      path.resolve(options.requestRegistryPath),
      requestRegistry
    );

    for (const mediaSlug of touchedMediaSlugs) {
      const bundle = bundleBySlug.get(mediaSlug);

      if (!bundle) {
        continue;
      }

      await writeBundlePronunciationPendingSummary({
        bundle,
        knownMissingPath: path.resolve(options.knownMissingPath),
        knownMissingRegistry
      });
    }
  }

  printSummary(results);
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    audioIndexPath: "/tmp/forvo-requested-audio-index.json",
    contentRoot: "content",
    dryRun: false,
    knownMissingPath: path.join("data", "forvo-known-missing.json"),
    refresh: false,
    requestRegistryPath: path.join("data", "forvo-requested-word-add.json")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--") {
      continue;
    }

    if (argument === "--audio-index") {
      options.audioIndexPath = readOptionValue(argv, index, "--audio-index");
      index += 1;
      continue;
    }

    if (argument === "--content-root") {
      options.contentRoot = readOptionValue(argv, index, "--content-root");
      index += 1;
      continue;
    }

    if (argument === "--known-missing-file") {
      options.knownMissingPath = readOptionValue(
        argv,
        index,
        "--known-missing-file"
      );
      index += 1;
      continue;
    }

    if (argument === "--request-registry-file") {
      options.requestRegistryPath = readOptionValue(
        argv,
        index,
        "--request-registry-file"
      );
      index += 1;
      continue;
    }

    if (argument === "--limit") {
      options.limit = readNonNegativeIntegerOption(argv, index, "--limit");
      index += 1;
      continue;
    }

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (argument === "--refresh") {
      options.refresh = true;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

async function loadAudioIndex(filePath: string) {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<{ entries: unknown[] }>;
  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.filter(isAudioIndexEntry)
    : [];

  return {
    entries
  };
}

function isAudioIndexEntry(value: unknown): value is AudioIndexEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AudioIndexEntry>;

  return (
    (candidate.entryKind === "grammar" || candidate.entryKind === "term") &&
    typeof candidate.entryId === "string" &&
    typeof candidate.mediaSlug === "string"
  );
}

async function getManifestEntries(input: {
  manifestByMediaSlug: Map<
    string,
    Awaited<ReturnType<typeof loadValidatedManifest>>["entries"]
  >;
  mediaSlug: string;
}) {
  const cached = input.manifestByMediaSlug.get(input.mediaSlug);

  if (cached) {
    return cached;
  }

  const bundle = parseResult.ok
    ? parseResult.data.bundles.find(
        (candidate) => candidate.mediaSlug === input.mediaSlug
      )
    : undefined;

  if (!bundle) {
    throw new Error(`Unknown media bundle '${input.mediaSlug}'.`);
  }

  const { entries } = await loadValidatedManifest(
    bundle.mediaDirectory,
    bundle.mediaSlug
  );

  input.manifestByMediaSlug.set(input.mediaSlug, entries);

  return entries;
}

function buildImportedForvoAudioPath(input: {
  entry: AudioIndexEntry;
  speaker?: string;
  target: PronunciationTargetEntry;
}) {
  const speakerSegment = slugifyForvoSegment(input.speaker ?? "forvo");
  const labelSegment = slugifyForvoSegment(
    input.target.reading ?? input.entry.reading ?? input.target.label
  );

  return `assets/audio/${input.entry.entryKind}/${input.entry.entryId}/forvo-${speakerSegment}-${labelSegment}.mp3`;
}

async function downloadAndStoreAudio(input: {
  candidates: AudioCandidate[];
  pageUrl?: string;
  targetPath: string;
}) {
  const errors: string[] = [];

  await mkdir(path.dirname(input.targetPath), { recursive: true });

  for (const candidate of input.candidates) {
    if (!candidate.url) {
      continue;
    }

    try {
      const buffer = await downloadAudio(candidate.url, input.pageUrl);
      const format = inferCandidateFormat(candidate);

      if (format === "mp3") {
        await writeFile(input.targetPath, buffer);
        return;
      }

      await convertAudioBufferToMp3({
        buffer,
        format,
        targetPath: input.targetPath
      });
      return;
    } catch (error) {
      errors.push(
        `${candidate.url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new Error(
    `No downloadable Forvo audio candidate worked for '${input.targetPath}'. ${errors.join("; ")}`
  );
}

async function downloadAudio(url: string, pageUrl?: string) {
  const response = await fetch(url, {
    headers: {
      Referer: pageUrl ?? "https://forvo.com/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function inferCandidateFormat(candidate: AudioCandidate) {
  if (candidate.format === "mp3" || candidate.format === "ogg") {
    return candidate.format;
  }

  const extension = path.extname(candidate.decodedPath ?? candidate.url ?? "")
    .replace(".", "")
    .toLowerCase();

  return extension === "mp3" ? "mp3" : "ogg";
}

async function convertAudioBufferToMp3(input: {
  buffer: Buffer;
  format: string;
  targetPath: string;
}) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "forvo-audio-"));
  const sourcePath = path.join(tempDir, `source.${input.format}`);

  try {
    await writeFile(sourcePath, input.buffer);
    await runFfmpeg([
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      sourcePath,
      "-codec:a",
      "libmp3lame",
      "-q:a",
      "2",
      input.targetPath
    ]);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

function markRequestResolved(input: {
  audioSrc: string;
  entry: AudioIndexEntry;
  requestRegistry: Awaited<ReturnType<typeof loadForvoWordAddRequestRegistry>>;
}) {
  const match = input.requestRegistry.entries.find(
    (candidate) =>
      candidate.mediaSlug === input.entry.mediaSlug &&
      candidate.entryKind === input.entry.entryKind &&
      candidate.entryId === input.entry.entryId
  );

  if (!match) {
    return;
  }

  match.resolvedAt = match.resolvedAt ?? new Date().toISOString();
  match.resolvedAudioSource = "forvo";
  match.resolvedAudioSrc = input.audioSrc;
}

function removeKnownMissingEntry(input: {
  entry: AudioIndexEntry;
  knownMissingRegistry: Awaited<ReturnType<typeof loadForvoKnownMissingRegistry>>;
}) {
  input.knownMissingRegistry.entries =
    input.knownMissingRegistry.entries.filter(
      (candidate) =>
        !(
          candidate.mediaSlug === input.entry.mediaSlug &&
          candidate.entryKind === input.entry.entryKind &&
          candidate.entryId === input.entry.entryId
        )
    );
}

function printSummary(
  results: Array<{
    entryId: string;
    entryKind: "grammar" | "term";
    mediaSlug: string;
    speaker?: string;
    status: string;
  }>
) {
  const byStatus = countBy(results, (result) => result.status);
  const byMedia = countBy(
    results.filter((result) => result.status === "downloaded"),
    (result) => result.mediaSlug
  );
  const bySpeaker = countBy(
    results.filter((result) => result.status === "downloaded"),
    (result) => result.speaker ?? "(unknown)"
  );

  console.info(
    `Forvo requested import: downloaded=${byStatus.downloaded ?? 0} skipped_existing=${byStatus.skipped_existing ?? 0} missing_target=${byStatus.missing_target ?? 0}`
  );
  console.info(`  by media: ${formatCountMap(byMedia)}`);
  console.info(`  by speaker: ${formatCountMap(bySpeaker)}`);
}

function countBy<T>(values: T[], readKey: (value: T) => string) {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    const key = readKey(value);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function formatCountMap(value: Record<string, number>) {
  const entries = Object.entries(value).sort((left, right) =>
    left[0].localeCompare(right[0])
  );

  return entries.length > 0
    ? entries.map(([key, count]) => `${key}=${count}`).join(" ")
    : "none";
}

function buildScopedEntryKey(
  mediaSlug: string,
  entryKind: "grammar" | "term",
  entryId: string
) {
  return `${mediaSlug}:${entryKind}:${entryId}`;
}

function readOptionValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function readNonNegativeIntegerOption(
  argv: string[],
  index: number,
  flag: string
) {
  const raw = readOptionValue(argv, index, flag);
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }

  return parsed;
}
