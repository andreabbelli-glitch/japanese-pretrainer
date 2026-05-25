import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  fetchKotuRawPitchBaseline,
  parseKotuPitchBaselineCache,
  type KotuPitchBaselineCache,
  type KotuPitchBaselineCacheEntry
} from "../src/features/pitch-accent/tooling/kotu-baseline.ts";

async function main() {
  const options = parseCliOptions(process.argv.slice(2));

  if (!options.allowKotuApi) {
    throw new Error(
      "Refusing Kotu API access without --allow-kotu-api. This script is opt-in by design."
    );
  }
  if (options.pronunciationIds.length === 0) {
    throw new Error("Pass at least one --pronunciation-id.");
  }

  const existingCache = await readExistingCache(options.cachePath);
  const entries = [...existingCache.entries];

  for (const [index, pronunciationId] of options.pronunciationIds.entries()) {
    if (index > 0) {
      await delay(options.delayMs);
    }

    const fetched = await fetchKotuRawPitchBaseline({
      baseUrl: options.baseUrl,
      pronunciationId
    });
    entries.push({
      ...fetched,
      audioSha256: options.audioSha256,
      durationMs: options.durationMs,
      pcmFingerprint: options.pcmFingerprint,
      pitchAccent: options.pitchAccent,
      rawPronunciation: options.rawPronunciation
    });
    console.info(
      `Fetched ${fetched.rawPitchValues.length} raw-pitch frames for ${pronunciationId}.`
    );
  }

  await writeCache(options.cachePath, {
    entries: dedupeEntries(entries),
    version: 1
  });
  console.info(`Wrote Kotu baseline cache: ${options.cachePath}`);
}

function parseCliOptions(argv: readonly string[]) {
  const options: {
    allowKotuApi: boolean;
    audioSha256?: string;
    baseUrl: string;
    cachePath: string;
    delayMs: number;
    durationMs?: number;
    pcmFingerprint?: string;
    pitchAccent?: number;
    pronunciationIds: string[];
    rawPronunciation?: string;
  } = {
    allowKotuApi: false,
    baseUrl: "https://kotu.io",
    cachePath: ".tmp/pitch-graph-bakeoff/kotu-baseline-cache.json",
    delayMs: 2_000,
    pronunciationIds: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--") {
      continue;
    }

    switch (argument) {
      case "--allow-kotu-api":
        options.allowKotuApi = true;
        break;
      case "--audio-sha256":
        options.audioSha256 = readValue(argv, index, argument);
        index += 1;
        break;
      case "--base-url":
        options.baseUrl = readValue(argv, index, argument);
        index += 1;
        break;
      case "--cache-path":
        options.cachePath = readValue(argv, index, argument);
        index += 1;
        break;
      case "--delay-ms":
        options.delayMs = readNonNegativeInteger(argv, index, argument);
        index += 1;
        break;
      case "--duration-ms":
        options.durationMs = readNonNegativeInteger(argv, index, argument);
        index += 1;
        break;
      case "--pcm-fingerprint":
        options.pcmFingerprint = readValue(argv, index, argument);
        index += 1;
        break;
      case "--pitch-accent":
        options.pitchAccent = readNonNegativeInteger(argv, index, argument);
        index += 1;
        break;
      case "--pronunciation-id":
        options.pronunciationIds.push(readValue(argv, index, argument));
        index += 1;
        break;
      case "--raw-pronunciation":
        options.rawPronunciation = readValue(argv, index, argument);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

async function readExistingCache(
  cachePath: string
): Promise<KotuPitchBaselineCache> {
  try {
    return parseKotuPitchBaselineCache(await readFile(cachePath, "utf8"));
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        entries: [],
        version: 1
      };
    }

    throw error;
  }
}

async function writeCache(cachePath: string, cache: KotuPitchBaselineCache) {
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
}

function dedupeEntries(
  entries: readonly KotuPitchBaselineCacheEntry[]
): readonly KotuPitchBaselineCacheEntry[] {
  const byId = new Map<string, KotuPitchBaselineCacheEntry>();

  for (const entry of entries) {
    byId.set(entry.kotuPronunciationId, entry);
  }

  return [...byId.values()].sort((left, right) =>
    left.kotuPronunciationId.localeCompare(right.kotuPronunciationId)
  );
}

function readValue(argv: readonly string[], index: number, flag: string) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function readNonNegativeInteger(
  argv: readonly string[],
  index: number,
  flag: string
) {
  const value = Number.parseInt(readValue(argv, index, flag), 10);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }

  return value;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isMissingFileError(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
