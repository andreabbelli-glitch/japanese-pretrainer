import { execFile } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  readdir
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { NormalizedMediaBundle } from "./content/types.ts";
import { buildEntryKey } from "./entry-id.ts";
import { stripInlineMarkdown } from "./inline-markdown.ts";
import {
  loadValidatedManifest,
  mergePronunciationAudioManifestEntry,
  persistManifestEntries
} from "./manifest-helpers.ts";
import {
  collectPronunciationTargets,
  type PronunciationTargetEntry
} from "./pronunciation-shared.ts";

const execFileAsync = promisify(execFile);

export const tofuguPronunciationDatasetDefaultDirectory = path.join(
  "data",
  "tofugu-japanese-vocabulary-pronunciation-audio"
);
export const tofuguPronunciationDatasetRepositoryUrl =
  "https://github.com/tofugu/japanese-vocabulary-pronunciation-audio.git";

const tofuguAudioSource = "tofugu_wanikani";
const tofuguAudioLicense = "CC-BY-SA-4.0";
const tofuguAudioAttribution = "Tofugu and WaniKani";
const tofuguGitHubBlobBaseUrl =
  "https://github.com/tofugu/japanese-vocabulary-pronunciation-audio/blob/master";
const mp3ExtensionPattern = /\.mp3$/iu;
const finalReadingPattern = /^(?<surface>[^【】]+)【(?<reading>[^【】]+)】$/u;
const japaneseScriptPattern = /[ぁ-ゟ゠-ヿ一-龯々〆ヶ]/u;
const latinLetterPattern = /[a-z]/iu;
const markerPattern = /[〜～~]/gu;
const whitespacePattern = /\s+/gu;

export type TofuguPronunciationDatasetEntry = {
  datasetRelativePath: string;
  filePath: string;
  pageUrl: string;
  reading?: string;
  surface: string;
};

export type TofuguPronunciationIndex = {
  bySurface: Map<string, TofuguPronunciationDatasetEntry[]>;
  bySurfaceAndReading: Map<string, TofuguPronunciationDatasetEntry[]>;
  datasetDir: string;
  entries: TofuguPronunciationDatasetEntry[];
};

export type TofuguMatchResult =
  | {
      candidates: TofuguPronunciationDatasetEntry[];
      status: "ambiguous";
    }
  | {
      entry: TofuguPronunciationDatasetEntry;
      status: "matched";
    }
  | {
      status: "not_found";
    };

export type TofuguPronunciationImportResult = {
  entryId: string;
  kind: "grammar" | "term";
  status: "already_audio_backed" | "ambiguous" | "matched" | "not_found";
};

export type TofuguPronunciationImportSummary = {
  alreadyAudioBacked: number;
  ambiguous: number;
  matched: number;
  notFound: number;
  results: TofuguPronunciationImportResult[];
  unavailableReason?: string;
};

export function parseTofuguPronunciationFilename(fileName: string):
  | {
      reading?: string;
      surface: string;
    }
  | null {
  const baseName = path.basename(fileName);

  if (!mp3ExtensionPattern.test(baseName)) {
    return null;
  }

  const stem = baseName.replace(mp3ExtensionPattern, "");
  const readingMatch = stem.match(finalReadingPattern);

  if (!readingMatch?.groups) {
    if (/[【】]/u.test(stem)) {
      return null;
    }

    return stem.trim().length > 0 ? { surface: stem.trim() } : null;
  }

  const surface = readingMatch.groups.surface?.trim() ?? "";
  const reading = readingMatch.groups.reading?.trim() ?? "";

  if (!surface || !reading) {
    return null;
  }

  return {
    reading,
    surface
  };
}

export async function buildTofuguPronunciationIndex(
  datasetDir = tofuguPronunciationDatasetDefaultDirectory
): Promise<TofuguPronunciationIndex> {
  const absoluteDatasetDir = path.resolve(datasetDir);
  const audioRoot = path.join(absoluteDatasetDir, "lib", "mp3");
  const audioFiles = await listMp3Files(audioRoot);
  const entries: TofuguPronunciationDatasetEntry[] = [];

  for (const filePath of audioFiles) {
    const parsed = parseTofuguPronunciationFilename(filePath);

    if (!parsed) {
      continue;
    }

    const datasetRelativePath = toPosixPath(
      path.relative(absoluteDatasetDir, filePath)
    );

    entries.push({
      datasetRelativePath,
      filePath,
      pageUrl: buildTofuguGitHubPageUrl(datasetRelativePath),
      reading: parsed.reading,
      surface: parsed.surface
    });
  }

  const bySurface = new Map<string, TofuguPronunciationDatasetEntry[]>();
  const bySurfaceAndReading = new Map<
    string,
    TofuguPronunciationDatasetEntry[]
  >();

  for (const entry of entries) {
    pushIndexValue(bySurface, normalizeExactJapaneseText(entry.surface), entry);

    if (entry.reading) {
      pushIndexValue(
        bySurfaceAndReading,
        buildSurfaceReadingKey(entry.surface, entry.reading),
        entry
      );
    }
  }

  return {
    bySurface,
    bySurfaceAndReading,
    datasetDir: absoluteDatasetDir,
    entries
  };
}

export function findTofuguMatchForTarget(
  target: PronunciationTargetEntry,
  index: TofuguPronunciationIndex
): TofuguMatchResult {
  const candidates =
    target.kind === "term"
      ? findTermCandidates(target, index)
      : findGrammarCandidates(target, index);
  const uniqueCandidates = uniqueEntries(candidates);

  if (uniqueCandidates.length === 0) {
    return { status: "not_found" };
  }

  if (uniqueCandidates.length > 1) {
    return {
      candidates: uniqueCandidates,
      status: "ambiguous"
    };
  }

  return {
    entry: uniqueCandidates[0]!,
    status: "matched"
  };
}

export async function importTofuguPronunciationsForBundle(input: {
  bundle: NormalizedMediaBundle;
  datasetDir?: string;
  dryRun?: boolean;
  onlyTargets?: PronunciationTargetEntry[];
  refresh?: boolean;
}): Promise<TofuguPronunciationImportSummary> {
  let index: TofuguPronunciationIndex;

  try {
    index = await buildTofuguPronunciationIndex(input.datasetDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return buildUnavailableImportSummary(
        `Tofugu/WaniKani pronunciation dataset was not found at '${path.resolve(
          input.datasetDir ?? tofuguPronunciationDatasetDefaultDirectory
        )}'.`
      );
    }

    throw error;
  }

  const { entries: manifestEntries } = await loadValidatedManifest(
    input.bundle.mediaDirectory,
    input.bundle.mediaSlug
  );
  const selectedTargets =
    input.onlyTargets ?? collectPronunciationTargets(input.bundle);
  const results: TofuguPronunciationImportResult[] = [];
  let matched = 0;
  let ambiguous = 0;
  let notFound = 0;
  let alreadyAudioBacked = 0;

  for (const target of selectedTargets) {
    const entryKey = buildEntryKey(target.kind, target.id);
    const existingManifestEntry = manifestEntries.get(entryKey);

    if (
      !input.refresh &&
      (target.audioSrc || existingManifestEntry?.audioSrc)
    ) {
      alreadyAudioBacked += 1;
      results.push({
        entryId: target.id,
        kind: target.kind,
        status: "already_audio_backed"
      });
      continue;
    }

    const match = findTofuguMatchForTarget(target, index);

    if (match.status === "not_found") {
      notFound += 1;
      results.push({
        entryId: target.id,
        kind: target.kind,
        status: "not_found"
      });
      continue;
    }

    if (match.status === "ambiguous") {
      ambiguous += 1;
      results.push({
        entryId: target.id,
        kind: target.kind,
        status: "ambiguous"
      });
      continue;
    }

    matched += 1;
    results.push({
      entryId: target.id,
      kind: target.kind,
      status: "matched"
    });

    const audioSrc = buildTofuguAudioAssetPath(target);

    manifestEntries.set(
      entryKey,
      mergePronunciationAudioManifestEntry({
        audio: {
          audioAttribution: tofuguAudioAttribution,
          audioLicense: tofuguAudioLicense,
          audioPageUrl: match.entry.pageUrl,
          audioSource: tofuguAudioSource,
          audioSrc
        },
        entryId: target.id,
        entryType: target.kind,
        existing: existingManifestEntry
      })
    );

    if (!input.dryRun) {
      const absoluteAssetPath = path.join(target.mediaDirectory, audioSrc);
      await mkdir(path.dirname(absoluteAssetPath), { recursive: true });
      await copyFile(match.entry.filePath, absoluteAssetPath);
    }
  }

  if (!input.dryRun && matched > 0) {
    await persistManifestEntries(input.bundle.mediaDirectory, manifestEntries);
  }

  return {
    alreadyAudioBacked,
    ambiguous,
    matched,
    notFound,
    results
  };
}

export async function syncTofuguPronunciationDataset(input: {
  datasetDir?: string;
  repositoryUrl?: string;
}) {
  const datasetDir = path.resolve(
    input.datasetDir ?? tofuguPronunciationDatasetDefaultDirectory
  );
  const repositoryUrl =
    input.repositoryUrl ?? tofuguPronunciationDatasetRepositoryUrl;

  if (await pathExists(path.join(datasetDir, ".git"))) {
    await execFileAsync("git", ["-C", datasetDir, "pull", "--ff-only"]);
    return {
      datasetDir,
      status: "updated" as const
    };
  }

  await mkdir(path.dirname(datasetDir), { recursive: true });
  await execFileAsync("git", [
    "clone",
    "--depth",
    "1",
    repositoryUrl,
    datasetDir
  ]);

  return {
    datasetDir,
    status: "cloned" as const
  };
}

function findTermCandidates(
  target: PronunciationTargetEntry,
  index: TofuguPronunciationIndex
) {
  const surfaceValues = buildJapaneseSurfaceValues([
    target.label,
    ...target.aliases
  ]);

  const reading = target.reading;

  if (reading) {
    return surfaceValues.flatMap((surface) =>
      index.bySurfaceAndReading.get(buildSurfaceReadingKey(surface, reading)) ??
      []
    );
  }

  return surfaceValues.flatMap(
    (surface) => index.bySurface.get(normalizeExactJapaneseText(surface)) ?? []
  );
}

function findGrammarCandidates(
  target: PronunciationTargetEntry,
  index: TofuguPronunciationIndex
) {
  return buildJapaneseSurfaceValues([target.label, ...target.aliases]).flatMap(
    (surface) => index.bySurface.get(normalizeExactJapaneseText(surface)) ?? []
  );
}

function buildJapaneseSurfaceValues(values: string[]) {
  return [
    ...new Set(
      values
        .map(normalizeExactJapaneseText)
        .filter((value) => japaneseScriptPattern.test(value))
        .filter((value) => !latinLetterPattern.test(value))
    )
  ];
}

function buildSurfaceReadingKey(surface: string, reading: string) {
  return `${normalizeExactJapaneseText(surface)}\u0000${normalizeExactJapaneseText(
    reading
  )}`;
}

function normalizeExactJapaneseText(value: string) {
  return stripInlineMarkdown(value)
    .normalize("NFKC")
    .replace(markerPattern, "")
    .replace(whitespacePattern, " ")
    .trim();
}

function buildTofuguAudioAssetPath(target: PronunciationTargetEntry) {
  const labelSegment = slugifyTofuguAssetSegment(target.label);

  return `assets/audio/${target.kind}/${target.id}/tofugu-wanikani-${labelSegment}.mp3`;
}

function slugifyTofuguAssetSegment(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized.length > 0 ? normalized : "audio";
}

function buildTofuguGitHubPageUrl(datasetRelativePath: string) {
  return `${tofuguGitHubBlobBaseUrl}/${datasetRelativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function pushIndexValue(
  index: Map<string, TofuguPronunciationDatasetEntry[]>,
  key: string,
  value: TofuguPronunciationDatasetEntry
) {
  const existing = index.get(key);

  if (existing) {
    existing.push(value);
    return;
  }

  index.set(key, [value]);
}

function uniqueEntries(entries: TofuguPronunciationDatasetEntry[]) {
  return [...new Map(entries.map((entry) => [entry.filePath, entry])).values()];
}

async function listMp3Files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listMp3Files(entryPath)));
      continue;
    }

    if (entry.isFile() && mp3ExtensionPattern.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function toPosixPath(value: string) {
  return value.split(path.sep).join(path.posix.sep);
}

function buildUnavailableImportSummary(
  unavailableReason: string
): TofuguPronunciationImportSummary {
  return {
    alreadyAudioBacked: 0,
    ambiguous: 0,
    matched: 0,
    notFound: 0,
    results: [],
    unavailableReason
  };
}
