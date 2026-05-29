import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import {
  parseTofuguPronunciationFilename,
  tofuguPronunciationDatasetDefaultDirectory
} from "../../pronunciation/tooling/tofugu-dataset.ts";
import { splitJapaneseMorae } from "../model/notation.ts";

import {
  getPitchAccentPatternKey,
  validatePitchAccentMinimalPairsCorpus,
  type PitchAccentMinimalPair,
  type PitchAccentMinimalPairsCorpus,
  type PitchAccentPairOption
} from "../model/index.ts";

const TOFUGU_VENDOR_SLUG = "tofugu-pitch-minimal-pairs";
const TOFUGU_GENERATED_MARKER_FILE = ".tofugu-pitch-minimal-pairs-generated";
const KANJIUM_PAGE_URL =
  "https://github.com/mifunetoshiro/kanjium/blob/master/data/source_files/raw/accents.txt";
const TOFUGU_REPOSITORY_URL =
  "https://github.com/tofugu/japanese-vocabulary-pronunciation-audio";
const JAYDAR_REPOSITORY_URL = "https://github.com/Madoshakalaka/jaydar";
const JAYDAR_REVISION = "2c38cb381a698b9d84d920f7ffbfd2b090579cf2";
const DEFAULT_KANJIUM_DATA_PATH = path.join(
  "data",
  "pitch-accents",
  "kanjium-accents.txt"
);
const DEFAULT_KUUUUBE_MANIFEST_PATH = path.join(
  "public",
  "vendor",
  "minimal-pairs",
  "manifest.json"
);
const DEFAULT_OUT_DIR = path.join("public", "vendor", TOFUGU_VENDOR_SLUG);

type TofuguEntry = {
  readonly audioPath: string;
  readonly reading: string;
  readonly surface: string;
};

type JaydarWord = {
  readonly frequencyScore?: number;
  readonly isCommon?: boolean;
  readonly pitchAccents: readonly number[];
  readonly reading: string;
  readonly surface: string;
};

type ActiveCandidate = TofuguEntry & {
  readonly frequencyScore?: number;
  readonly isCommon?: boolean;
  readonly jaydarPitchAccents: readonly number[];
  readonly moraCount: number;
  readonly pitchAccent: number;
};

type AuditReason =
  | "covered_by_kuuuube"
  | "duplicate_tofugu_entry"
  | "invalid_pitch_range"
  | "jaydar_kanjium_pitch_mismatch"
  | "missing_kanjium_pitch"
  | "multiple_kanjium_pitches"
  | "not_confirmed_by_jaydar"
  | "same_pitch_only";

export type TofuguPitchMinimalPairsAuditEntry = {
  readonly contrast?: string;
  readonly detail?: string;
  readonly reason: AuditReason;
  readonly reading: string;
  readonly surface?: string;
  readonly surfaces?: readonly string[];
};

export type TofuguPitchMinimalPairsAudit = {
  readonly entries: readonly TofuguPitchMinimalPairsAuditEntry[];
  readonly generatedAt: string;
  readonly source: {
    readonly jaydarRevision: string;
    readonly jaydarSource: string;
    readonly kanjiumSource: string;
    readonly kuuuubeManifestPath: string;
    readonly tofuguDatasetPath: string;
  };
  readonly summary: Record<string, number>;
  readonly version: 1;
};

export type GenerateTofuguPitchMinimalPairsCorpusResult = {
  readonly audit: TofuguPitchMinimalPairsAudit;
  readonly audioFileCount: number;
  readonly optionCount: number;
  readonly pairCount: number;
};

export async function generateTofuguPitchMinimalPairsCorpus(input: {
  readonly allowNonVendorOutDir?: boolean;
  readonly dryRun?: boolean;
  readonly importedAt?: string;
  readonly jaydarExportPath: string;
  readonly kanjiumDataPath?: string;
  readonly kuuuubeManifestPath?: string;
  readonly outDir?: string;
  readonly tofuguDatasetDir?: string;
}): Promise<GenerateTofuguPitchMinimalPairsCorpusResult> {
  const importedAt = input.importedAt ?? new Date().toISOString();
  const tofuguDatasetDir = path.resolve(
    input.tofuguDatasetDir ?? tofuguPronunciationDatasetDefaultDirectory
  );
  const kanjiumDataPath = path.resolve(
    input.kanjiumDataPath ?? DEFAULT_KANJIUM_DATA_PATH
  );
  const kuuuubeManifestPath = path.resolve(
    input.kuuuubeManifestPath ?? DEFAULT_KUUUUBE_MANIFEST_PATH
  );
  const outDir = path.resolve(input.outDir ?? DEFAULT_OUT_DIR);
  const tofuguEntries = await readTofuguEntries(tofuguDatasetDir);
  const kanjiumIndex = parseKanjiumIndex(
    await readFile(kanjiumDataPath, "utf8")
  );
  const jaydarIndex = parseJaydarExport(
    await readFile(path.resolve(input.jaydarExportPath), "utf8")
  );
  const kuuuubeCoverage = buildCorpusCoverage(
    JSON.parse(
      await readFile(kuuuubeManifestPath, "utf8")
    ) as PitchAccentMinimalPairsCorpus
  );
  const auditEntries: TofuguPitchMinimalPairsAuditEntry[] = [];
  const pairs: PitchAccentMinimalPair[] = [];
  let audioFileCount = 0;

  const entriesByReading = groupTofuguEntriesByReading(
    tofuguEntries,
    auditEntries
  );
  const missingReadings = [...entriesByReading.entries()]
    .filter(([, entries]) => entries.length >= 2)
    .map(([reading]) => reading)
    .filter((reading) => !jaydarIndex.has(reading))
    .sort();

  if (missingReadings.length > 0) {
    throw new Error(
      `Jaydar export is missing readings: ${missingReadings.join(", ")}`
    );
  }

  for (const [reading, entries] of [...entriesByReading.entries()].sort()) {
    if (entries.length < 2) {
      continue;
    }

    const jaydarWords =
      jaydarIndex.get(reading) ?? new Map<string, JaydarWord>();
    const activeCandidates: ActiveCandidate[] = [];

    for (const entry of entries) {
      const jaydarWord = jaydarWords.get(entry.surface);

      if (!jaydarWord) {
        auditEntries.push({
          reason: "not_confirmed_by_jaydar",
          reading,
          surface: entry.surface
        });
        continue;
      }

      const pitchAccents =
        kanjiumIndex.get(buildSurfaceReadingKey(entry.surface, reading)) ?? [];

      if (pitchAccents.length === 0) {
        auditEntries.push({
          reason: "missing_kanjium_pitch",
          reading,
          surface: entry.surface
        });
        continue;
      }
      if (pitchAccents.length > 1) {
        auditEntries.push({
          detail: pitchAccents.join(","),
          reason: "multiple_kanjium_pitches",
          reading,
          surface: entry.surface
        });
        continue;
      }

      const pitchAccent = pitchAccents[0]!;
      if (
        jaydarWord.pitchAccents.length > 0 &&
        !jaydarWord.pitchAccents.includes(pitchAccent)
      ) {
        auditEntries.push({
          detail: `jaydar=${jaydarWord.pitchAccents.join(",")} kanjium=${pitchAccent}`,
          reason: "jaydar_kanjium_pitch_mismatch",
          reading,
          surface: entry.surface
        });
        continue;
      }

      const moraCount = splitJapaneseMorae(reading).length;
      if (pitchAccent < 0 || pitchAccent > moraCount) {
        auditEntries.push({
          detail: `pitch=${pitchAccent} moraCount=${moraCount}`,
          reason: "invalid_pitch_range",
          reading,
          surface: entry.surface
        });
        continue;
      }

      activeCandidates.push({
        ...entry,
        frequencyScore: jaydarWord.frequencyScore,
        isCommon: jaydarWord.isCommon,
        jaydarPitchAccents: jaydarWord.pitchAccents,
        moraCount,
        pitchAccent
      });
    }

    for (const pairCandidates of buildBinaryCandidatePairs(activeCandidates)) {
      const [left, right] = pairCandidates;
      const coverageKey = buildCoverageKey(
        reading,
        left.pitchAccent,
        right.pitchAccent
      );

      if (left.pitchAccent === right.pitchAccent) {
        auditEntries.push({
          reason: "same_pitch_only",
          reading,
          surfaces: [left.surface, right.surface]
        });
        continue;
      }

      if (kuuuubeCoverage.has(coverageKey)) {
        auditEntries.push({
          contrast: formatContrast(left.pitchAccent, right.pitchAccent),
          reason: "covered_by_kuuuube",
          reading,
          surfaces: [left.surface, right.surface]
        });
        continue;
      }

      const pair = await buildPitchAccentPair({
        left,
        reading,
        right
      });

      pairs.push(pair);
      audioFileCount += pair.options.length;
    }
  }

  const corpus: PitchAccentMinimalPairsCorpus = {
    pairs,
    source: {
      importedAt,
      license: "CC-BY-SA-4.0",
      repository: TOFUGU_REPOSITORY_URL,
      revision: await resolveTofuguRevision(tofuguDatasetDir)
    },
    version: 1
  };
  const validation = validatePitchAccentMinimalPairsCorpus(corpus, {
    allowedAudioSrcPrefixes: [`/vendor/${TOFUGU_VENDOR_SLUG}/audio/`]
  });

  if (!validation.ok) {
    throw new Error(
      `Generated Tofugu pitch minimal-pairs corpus is invalid: ${validation.errors.join(
        "; "
      )}`
    );
  }

  const audit = buildAudit({
    entries: auditEntries,
    generatedAt: importedAt,
    jaydarExportPath: path.resolve(input.jaydarExportPath),
    kanjiumDataPath,
    kuuuubeManifestPath,
    tofuguDatasetDir
  });

  if (!input.dryRun) {
    await assertSafeOutputDir(outDir, input.allowNonVendorOutDir ?? false);
    await rm(outDir, { recursive: true, force: true });
    await mkdir(path.join(outDir, "audio"), { recursive: true });
    await writeFile(
      path.join(outDir, TOFUGU_GENERATED_MARKER_FILE),
      "Generated by pitch-accent:generate-tofugu-pairs.\n"
    );

    for (const pair of pairs) {
      for (const option of pair.options) {
        const candidate = [option.surface, option.reading].join("\u0000");
        const source = candidateSourcePaths.get(candidate);

        if (!source) {
          throw new Error(`Missing source audio for ${option.id}.`);
        }

        const outputPath = path.join(
          outDir,
          option.audioSrc.replace(`/vendor/${TOFUGU_VENDOR_SLUG}/`, "")
        );

        await mkdir(path.dirname(outputPath), { recursive: true });
        await copyFile(source, outputPath);
      }
    }

    await writeFile(
      path.join(outDir, "manifest.json"),
      `${JSON.stringify(corpus, null, 2)}\n`
    );
    await writeFile(
      path.join(outDir, "audit.json"),
      `${JSON.stringify(audit, null, 2)}\n`
    );
    await writeFile(path.join(outDir, "NOTICE.md"), buildNotice(importedAt));
  }

  return {
    audit,
    audioFileCount,
    optionCount: pairs.reduce((total, pair) => total + pair.options.length, 0),
    pairCount: pairs.length
  };
}

const candidateSourcePaths = new Map<string, string>();

async function readTofuguEntries(datasetDir: string): Promise<TofuguEntry[]> {
  const audioRoot = path.join(datasetDir, "lib", "mp3");
  const audioFiles = await listMp3Files(audioRoot);
  const entries: TofuguEntry[] = [];

  candidateSourcePaths.clear();

  for (const audioPath of audioFiles.sort()) {
    const parsed = parseTofuguPronunciationFilename(audioPath);

    if (!parsed?.reading) {
      continue;
    }

    const entry = {
      audioPath,
      reading: normalizeReading(parsed.reading),
      surface: normalizeSurface(parsed.surface)
    };

    candidateSourcePaths.set(
      [entry.surface, entry.reading].join("\u0000"),
      audioPath
    );
    entries.push(entry);
  }

  return entries;
}

function groupTofuguEntriesByReading(
  entries: readonly TofuguEntry[],
  auditEntries: TofuguPitchMinimalPairsAuditEntry[]
) {
  const byReading = new Map<string, TofuguEntry[]>();
  const seen = new Set<string>();

  for (const entry of entries) {
    const entryKey = buildSurfaceReadingKey(entry.surface, entry.reading);

    if (seen.has(entryKey)) {
      auditEntries.push({
        reason: "duplicate_tofugu_entry",
        reading: entry.reading,
        surface: entry.surface
      });
      continue;
    }
    seen.add(entryKey);

    const readingEntries = byReading.get(entry.reading) ?? [];
    readingEntries.push(entry);
    byReading.set(entry.reading, readingEntries);
  }

  for (const readingEntries of byReading.values()) {
    readingEntries.sort((left, right) =>
      left.surface.localeCompare(right.surface, "ja")
    );
  }

  return byReading;
}

function parseJaydarExport(source: string) {
  const records = parseJsonOrJsonl(source);
  const index = new Map<string, Map<string, JaydarWord>>();

  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }

    const rawRecord = record as Record<string, unknown>;
    const reading = normalizeReading(
      readString(rawRecord.reading) ?? readString(rawRecord.query) ?? ""
    );
    const homophones =
      readArray(rawRecord.homophones) ?? readArray(rawRecord.words);

    if (!reading || !homophones) {
      continue;
    }

    const readingWords = index.get(reading) ?? new Map<string, JaydarWord>();

    for (const rawWord of homophones) {
      if (!rawWord || typeof rawWord !== "object") {
        continue;
      }

      const word = rawWord as Record<string, unknown>;
      const surface = normalizeSurface(
        readString(word.surface) ?? readString(word.text) ?? ""
      );
      const wordReading = normalizeReading(readString(word.reading) ?? reading);

      if (!surface || wordReading !== reading) {
        continue;
      }

      readingWords.set(surface, {
        ...mergeJaydarWord(readingWords.get(surface), {
          frequencyScore:
            readNumber(word.frequencyScore) ?? readNumber(word.frequency_score),
          isCommon: readBoolean(word.isCommon) ?? readBoolean(word.is_common),
          pitchAccents: readPitchAccentArray(
            word.jaydarPitchAccents ?? word.pitchAccent ?? word.pitch_accent
          )
        }),
        reading,
        surface
      });
    }

    index.set(reading, readingWords);
  }

  return index;
}

function mergeJaydarWord(
  existing: JaydarWord | undefined,
  next: {
    readonly frequencyScore?: number;
    readonly isCommon?: boolean;
    readonly pitchAccents: readonly number[];
  }
) {
  return {
    frequencyScore: Math.max(
      existing?.frequencyScore ?? 0,
      next.frequencyScore ?? 0
    ),
    isCommon: Boolean(existing?.isCommon || next.isCommon),
    pitchAccents: [
      ...new Set([...(existing?.pitchAccents ?? []), ...next.pitchAccents])
    ].sort((left, right) => left - right)
  };
}

function parseJsonOrJsonl(source: string): unknown[] {
  const trimmed = source.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);

    return Array.isArray(parsed) ? parsed : [];
  }

  return trimmed
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
}

function parseKanjiumIndex(source: string) {
  const index = new Map<string, number[]>();

  for (const line of source.split(/\r?\n/u)) {
    const [surface, reading, accentsRaw] = line.split("\t");

    if (!surface || !reading || !accentsRaw) {
      continue;
    }

    const accents = [
      ...new Set(
        [...accentsRaw.matchAll(/\d+/gu)]
          .map((match) => Number(match[0]))
          .filter((accent) => Number.isInteger(accent) && accent >= 0)
      )
    ].sort((left, right) => left - right);

    if (accents.length > 0) {
      index.set(
        buildSurfaceReadingKey(
          normalizeSurface(surface),
          normalizeReading(reading)
        ),
        accents
      );
    }
  }

  return index;
}

function buildBinaryCandidatePairs(candidates: readonly ActiveCandidate[]) {
  const sorted = [...candidates].sort(compareCandidates);
  const pairs: Array<readonly [ActiveCandidate, ActiveCandidate]> = [];

  for (let left = 0; left < sorted.length; left += 1) {
    for (let right = left + 1; right < sorted.length; right += 1) {
      pairs.push([sorted[left]!, sorted[right]!]);
    }
  }

  return pairs;
}

async function buildPitchAccentPair(input: {
  readonly left: ActiveCandidate;
  readonly reading: string;
  readonly right: ActiveCandidate;
}): Promise<PitchAccentMinimalPair> {
  const [leftCandidate, rightCandidate] = [input.left, input.right].sort(
    compareCandidates
  );
  const contrast = formatContrast(
    leftCandidate.pitchAccent,
    rightCandidate.pitchAccent
  );
  const pairId = `tofugu_${contrast}_${shortHash(
    [
      input.reading,
      contrast,
      formatOptionIdentity(leftCandidate),
      formatOptionIdentity(rightCandidate)
    ].join("\t")
  )}`;
  const options = await Promise.all(
    [leftCandidate, rightCandidate].map((candidate, index) =>
      buildPitchAccentPairOption({ candidate, index, pairId })
    )
  );

  return {
    hasDevoiced: false,
    id: pairId,
    kana: input.reading,
    optionCount: options.length,
    options,
    patternKeys: [
      ...new Set(options.map((option) => getPitchAccentPatternKey(option)))
    ]
  };
}

async function buildPitchAccentPairOption(input: {
  readonly candidate: ActiveCandidate;
  readonly index: number;
  readonly pairId: string;
}): Promise<PitchAccentPairOption> {
  const bytes = await readFile(input.candidate.audioPath);
  const audioSrc = `/vendor/${TOFUGU_VENDOR_SLUG}/audio/${input.pairId}/${input.index}.mp3`;

  return {
    accentedMora: input.candidate.pitchAccent,
    audioAttribution: "Tofugu and WaniKani",
    audioLicense: "CC-BY-SA-4.0",
    audioMime: "audio/mpeg",
    audioPageUrl: `${TOFUGU_REPOSITORY_URL}/blob/master/lib/mp3/${encodeURIComponent(
      path.basename(input.candidate.audioPath)
    )}`,
    audioSha256: sha256(bytes),
    audioSrc,
    byteLength: bytes.length,
    homophoneSource: "Jaydar/JMDict",
    id: `${input.pairId}:${shortHash(formatOptionIdentity(input.candidate))}`,
    moraCount: input.candidate.moraCount,
    pitchAccent: input.candidate.pitchAccent,
    pitchAccentSource: "Kanjium",
    rawPronunciation: toKatakana(input.candidate.reading),
    reading: input.candidate.reading,
    silencedMoras: [],
    sourceCorpus: "tofugu-jaydar-kanjium",
    surface: input.candidate.surface
  };
}

async function assertSafeOutputDir(
  outDir: string,
  allowNonVendorOutDir: boolean
) {
  const resolvedOutDir = path.resolve(outDir);
  const defaultVendorDir = path.resolve(process.cwd(), DEFAULT_OUT_DIR);

  if (resolvedOutDir !== defaultVendorDir && !allowNonVendorOutDir) {
    throw new Error(
      `Refusing to replace non-standard Tofugu pitch output directory: ${resolvedOutDir}.`
    );
  }

  const cwd = path.resolve(process.cwd());
  const root = path.parse(resolvedOutDir).root;
  const pathFromOutDirToCwd = path.relative(resolvedOutDir, cwd);
  const outDirContainsCwd =
    pathFromOutDirToCwd === "" ||
    (!pathFromOutDirToCwd.startsWith("..") &&
      !path.isAbsolute(pathFromOutDirToCwd));

  if (resolvedOutDir === root || outDirContainsCwd) {
    throw new Error(
      `Refusing to replace dangerous Tofugu pitch output directory: ${resolvedOutDir}.`
    );
  }

  const entries: string[] = await readdir(resolvedOutDir).catch(
    (error: unknown) => {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }

      throw error;
    }
  );

  if (entries.length > 0 && !entries.includes(TOFUGU_GENERATED_MARKER_FILE)) {
    throw new Error(
      `Refusing to replace non-empty Tofugu pitch output directory without ${TOFUGU_GENERATED_MARKER_FILE}: ${resolvedOutDir}.`
    );
  }
}

function buildAudit(input: {
  readonly entries: readonly TofuguPitchMinimalPairsAuditEntry[];
  readonly generatedAt: string;
  readonly jaydarExportPath: string;
  readonly kanjiumDataPath: string;
  readonly kuuuubeManifestPath: string;
  readonly tofuguDatasetDir: string;
}): TofuguPitchMinimalPairsAudit {
  const summary: Record<string, number> = {};

  for (const entry of input.entries) {
    summary[entry.reason] = (summary[entry.reason] ?? 0) + 1;
  }

  return {
    entries: [...input.entries].sort(compareAuditEntries),
    generatedAt: input.generatedAt,
    source: {
      jaydarRevision: JAYDAR_REVISION,
      jaydarSource: formatAuditSourcePath(input.jaydarExportPath),
      kanjiumSource: formatAuditSourcePath(input.kanjiumDataPath),
      kuuuubeManifestPath: formatAuditSourcePath(input.kuuuubeManifestPath),
      tofuguDatasetPath: formatAuditSourcePath(input.tofuguDatasetDir)
    },
    summary,
    version: 1
  };
}

function buildNotice(importedAt: string) {
  return `# Tofugu Pitch Minimal Pairs Vendor Notice

This directory contains a generated static pitch-accent minimal-pairs corpus
derived from local Tofugu/WaniKani pronunciation audio, Jaydar/JMDict homophone
membership, and Kanjium pitch accent data.

- Generated at: ${importedAt}
- Runtime corpus: public/vendor/${TOFUGU_VENDOR_SLUG}/manifest.json
- Audio source: Tofugu/WaniKani Japanese vocabulary pronunciation audio
- Audio license: CC-BY-SA-4.0
- Audio attribution: Tofugu and WaniKani
- Pitch accent source: Kanjium, CC-BY-SA-4.0
- Homophone membership: Jaydar using JMDict data
- Jaydar revision used for the export contract: ${JAYDAR_REVISION}
- Jaydar repository: ${JAYDAR_REPOSITORY_URL}
- Kanjium source: ${KANJIUM_PAGE_URL}

Jaydar is used only during offline corpus generation. The runtime app loads
only this normalized manifest and copied static audio subset.
`;
}

function buildCorpusCoverage(corpus: PitchAccentMinimalPairsCorpus) {
  const coverage = new Set<string>();

  for (const pair of corpus.pairs) {
    const pitches = [
      ...new Set(pair.options.map((option) => option.pitchAccent))
    ];
    for (let left = 0; left < pitches.length; left += 1) {
      for (let right = left + 1; right < pitches.length; right += 1) {
        coverage.add(
          buildCoverageKey(pair.kana, pitches[left]!, pitches[right]!)
        );
      }
    }
  }

  return coverage;
}

function buildCoverageKey(kana: string, leftPitch: number, rightPitch: number) {
  return `${normalizeReading(kana)}\t${formatContrast(leftPitch, rightPitch)}`;
}

function formatContrast(leftPitch: number, rightPitch: number) {
  const [left, right] = [leftPitch, rightPitch].sort(
    (left, right) => left - right
  );

  return `${left}-${right}`;
}

function buildSurfaceReadingKey(surface: string, reading: string) {
  return `${normalizeSurface(surface)}\u0000${normalizeReading(reading)}`;
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

    if (entry.isFile() && /\.mp3$/iu.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

async function resolveTofuguRevision(datasetDir: string) {
  const gitHeadPath = path.join(datasetDir, ".git", "HEAD");

  try {
    const head = (await readFile(gitHeadPath, "utf8")).trim();

    if (!head.startsWith("ref: ")) {
      return head;
    }

    const refPath = path.join(datasetDir, ".git", head.slice("ref: ".length));

    return (await readFile(refPath, "utf8")).trim();
  } catch {
    return "local";
  }
}

function compareCandidates(left: ActiveCandidate, right: ActiveCandidate) {
  return (
    left.pitchAccent - right.pitchAccent ||
    left.surface.localeCompare(right.surface, "ja") ||
    left.reading.localeCompare(right.reading, "ja")
  );
}

function formatOptionIdentity(candidate: ActiveCandidate) {
  return [candidate.surface, candidate.reading, candidate.pitchAccent].join(
    "\t"
  );
}

function compareAuditEntries(
  left: TofuguPitchMinimalPairsAuditEntry,
  right: TofuguPitchMinimalPairsAuditEntry
) {
  return (
    left.reason.localeCompare(right.reason, "en") ||
    left.reading.localeCompare(right.reading, "ja") ||
    (left.surface ?? "").localeCompare(right.surface ?? "", "ja")
  );
}

function formatAuditSourcePath(value: string) {
  const normalizedPath = value.normalize("NFKC");
  if (
    !path.isAbsolute(normalizedPath) &&
    !path.win32.isAbsolute(normalizedPath)
  ) {
    return toPosixPath(normalizedPath);
  }

  const relativePath = path.relative(process.cwd(), normalizedPath);
  if (
    relativePath &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  ) {
    return toPosixPath(relativePath);
  }

  return `external:${path.basename(normalizedPath)}`;
}

function toPosixPath(value: string) {
  return value.split(path.sep).join("/").replaceAll("\\", "/");
}

function normalizeSurface(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function normalizeReading(value: string) {
  return toHiragana(value)
    .normalize("NFKC")
    .replace(/[\s～〜・･]+/gu, "")
    .trim();
}

function toHiragana(value: string) {
  return [...value.normalize("NFKC")]
    .map((char) => {
      const code = char.codePointAt(0);

      if (code && code >= 0x30a1 && code <= 0x30f6) {
        return String.fromCodePoint(code - 0x60);
      }

      return char;
    })
    .join("");
}

function toKatakana(value: string) {
  return [...value.normalize("NFKC")]
    .map((char) => {
      const code = char.codePointAt(0);

      if (code && code >= 0x3041 && code <= 0x3096) {
        return String.fromCodePoint(code + 0x60);
      }

      return char;
    })
    .join("");
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readPitchAccentArray(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return [value];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.filter(
        (pitch): pitch is number =>
          typeof pitch === "number" && Number.isInteger(pitch) && pitch >= 0
      )
    )
  ].sort((left, right) => left - right);
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function shortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
