import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  isSafePitchAccentPairId,
  validatePitchAccentMinimalPairsCorpus,
  type PitchAccentMinimalPairsCorpus,
  type PitchAccentPairOption
} from "../model/index.ts";

export async function validateGeneratedMinimalPairsCorpus(input: {
  readonly outDir: string;
}): Promise<{ readonly errors: readonly string[]; readonly ok: boolean }> {
  return validateGeneratedPitchAccentCorpus({
    outDir: input.outDir,
    requiredFiles: ["LICENSE-GPL-3.0.txt", "NOTICE.md"],
    vendorSlug: "minimal-pairs"
  });
}

export async function validateGeneratedTofuguPitchMinimalPairsCorpus(input: {
  readonly kuuuubeManifestPath?: string;
  readonly outDir: string;
}): Promise<{ readonly errors: readonly string[]; readonly ok: boolean }> {
  const kuuuubeManifestPath =
    input.kuuuubeManifestPath ??
    path.join(
      process.cwd(),
      "public",
      "vendor",
      "minimal-pairs",
      "manifest.json"
    );
  const result = await validateGeneratedPitchAccentCorpus({
    outDir: input.outDir,
    requiredFiles: ["NOTICE.md", "audit.json"],
    vendorSlug: "tofugu-pitch-minimal-pairs"
  });

  if (!result.ok) {
    return result;
  }

  const errors = [...result.errors];
  const tofuguCorpus = await readManifest(input.outDir, errors);
  await validateTofuguAudit(input.outDir, errors);
  const kuuuubeCorpus = await readManifest(
    path.dirname(kuuuubeManifestPath),
    errors,
    path.basename(kuuuubeManifestPath)
  );

  if (!tofuguCorpus || !kuuuubeCorpus) {
    return {
      errors,
      ok: false
    };
  }

  const coverage = buildCorpusCoverage(kuuuubeCorpus);
  for (const pair of tofuguCorpus.pairs) {
    const pitches = [
      ...new Set(pair.options.map((option) => option.pitchAccent))
    ];

    if (pair.options.length !== 2) {
      errors.push(`${pair.id} must contain exactly two options.`);
      continue;
    }

    if (pitches.length !== 2) {
      errors.push(`${pair.id} must represent one binary pitch contrast.`);
      continue;
    }

    if (coverage.has(buildCoverageKey(pair.kana, pitches[0]!, pitches[1]!))) {
      errors.push(`${pair.id} duplicates a Kuuuube pitch contrast.`);
    }
  }

  return {
    errors,
    ok: errors.length === 0
  };
}

async function validateTofuguAudit(outDir: string, errors: string[]) {
  const audit = await readJson(path.join(outDir, "audit.json"), errors);
  if (!audit || typeof audit !== "object" || !("source" in audit)) {
    errors.push("audit.json source metadata is missing.");
    return;
  }

  const source = (audit as { readonly source?: unknown }).source;
  if (!source || typeof source !== "object") {
    errors.push("audit.json source metadata is invalid.");
    return;
  }

  for (const key of [
    "jaydarSource",
    "kanjiumSource",
    "kuuuubeManifestPath",
    "tofuguDatasetPath"
  ] as const) {
    const value = (source as Record<string, unknown>)[key];

    if (typeof value !== "string" || !value.trim()) {
      errors.push(`audit.json source.${key} must be a non-empty string.`);
      continue;
    }
    if (path.isAbsolute(value) || path.win32.isAbsolute(value)) {
      errors.push(`audit.json source.${key} must not be an absolute path.`);
    }
  }
}

async function validateGeneratedPitchAccentCorpus(input: {
  readonly outDir: string;
  readonly requiredFiles: readonly string[];
  readonly vendorSlug: string;
}): Promise<{ readonly errors: readonly string[]; readonly ok: boolean }> {
  const errors: string[] = [];
  const corpus = await readManifest(input.outDir, errors);

  for (const requiredFile of input.requiredFiles) {
    await requireFile(input.outDir, requiredFile, errors);
  }

  if (!corpus) {
    return { errors, ok: false };
  }

  errors.push(
    ...validatePitchAccentMinimalPairsCorpus(corpus, {
      allowedAudioSrcPrefixes: [`/vendor/${input.vendorSlug}/audio/`]
    }).errors
  );

  for (const pair of corpus.pairs) {
    for (const option of pair.options) {
      await validateAudioOption({
        errors,
        option,
        outDir: input.outDir,
        pairId: pair.id,
        vendorSlug: input.vendorSlug
      });
    }
  }

  return {
    errors,
    ok: errors.length === 0
  };
}

async function readManifest(
  outDir: string,
  errors: string[],
  manifestFileName = "manifest.json"
) {
  const manifestPath = path.join(outDir, manifestFileName);
  try {
    return (await readJson(
      manifestPath,
      errors
    )) as PitchAccentMinimalPairsCorpus | null;
  } catch (error) {
    errors.push(
      error instanceof Error
        ? `Unable to read ${manifestFileName}: ${error.message}`
        : `Unable to read ${manifestFileName}.`
    );
    return null;
  }
}

async function readJson(sourcePath: string, errors: string[]) {
  try {
    return JSON.parse(await readFile(sourcePath, "utf8")) as unknown;
  } catch (error) {
    errors.push(
      error instanceof Error
        ? `Unable to read ${path.basename(sourcePath)}: ${error.message}`
        : `Unable to read ${path.basename(sourcePath)}.`
    );
    return null;
  }
}

async function requireFile(
  outDir: string,
  relativePath: string,
  errors: string[]
) {
  try {
    await stat(path.join(outDir, relativePath));
  } catch {
    errors.push(`Missing ${relativePath}.`);
  }
}

async function validateAudioOption(input: {
  readonly errors: string[];
  readonly option: PitchAccentPairOption;
  readonly outDir: string;
  readonly pairId: string;
  readonly vendorSlug: string;
}) {
  const audioPath = resolveAudioPath(input);
  let bytes: Buffer;

  if (!audioPath) {
    return;
  }

  try {
    bytes = await readFile(audioPath);
  } catch {
    input.errors.push(`Missing audio file for ${input.option.id}.`);
    return;
  }

  if (
    input.option.byteLength !== undefined &&
    input.option.byteLength !== bytes.length
  ) {
    input.errors.push(
      `${input.option.id} byte length does not match manifest.`
    );
  }
  if (input.option.audioSha256 && input.option.audioSha256 !== sha256(bytes)) {
    input.errors.push(`${input.option.id} SHA-256 does not match manifest.`);
  }
  if (input.option.audioMime === "audio/aac" && !isAac(bytes)) {
    input.errors.push(
      `${input.option.id} audio MIME does not match AAC magic bytes.`
    );
  }
  if (input.option.audioMime === "audio/ogg" && !isOgg(bytes)) {
    input.errors.push(
      `${input.option.id} audio MIME does not match OGG magic bytes.`
    );
  }
  if (input.option.audioMime === "audio/mpeg" && !isMp3(bytes)) {
    input.errors.push(
      `${input.option.id} audio MIME does not match MP3 magic bytes.`
    );
  }
}

function resolveAudioPath(input: {
  readonly errors: string[];
  readonly option: PitchAccentPairOption;
  readonly outDir: string;
  readonly pairId: string;
  readonly vendorSlug: string;
}) {
  const prefix = `/vendor/${input.vendorSlug}/`;
  if (!isSafePitchAccentPairId(input.pairId)) {
    input.errors.push(`${input.option.id} audio path has an unsafe pair id.`);
    return null;
  }
  if (!input.option.audioSrc.startsWith(prefix)) {
    input.errors.push(
      `${input.option.id} audio path does not use the vendor prefix.`
    );
    return null;
  }

  const relativeAudioPath = input.option.audioSrc.slice(prefix.length);
  if (relativeAudioPath.includes("\\")) {
    input.errors.push(
      `${input.option.id} audio path contains an invalid separator.`
    );
    return null;
  }
  const pathSegments = relativeAudioPath.split("/");
  if (
    pathSegments.length < 3 ||
    pathSegments.some(
      (segment) => segment === "" || segment === "." || segment === ".."
    ) ||
    pathSegments[0] !== "audio" ||
    pathSegments[1] !== input.pairId
  ) {
    input.errors.push(
      `${input.option.id} audio path escapes its pair directory.`
    );
    return null;
  }

  const resolvedOutDir = path.resolve(input.outDir);
  const resolvedAudioPath = path.resolve(resolvedOutDir, ...pathSegments);
  const resolvedPairDir = path.resolve(resolvedOutDir, "audio", input.pairId);
  const relativeToOutDir = path.relative(resolvedOutDir, resolvedAudioPath);
  const relativeToPairDir = path.relative(resolvedPairDir, resolvedAudioPath);

  if (
    relativeToOutDir === "" ||
    relativeToOutDir.startsWith("..") ||
    path.isAbsolute(relativeToOutDir)
  ) {
    input.errors.push(
      `${input.option.id} audio path escapes the corpus directory.`
    );
    return null;
  }

  if (
    relativeToPairDir === "" ||
    relativeToPairDir.startsWith("..") ||
    path.isAbsolute(relativeToPairDir)
  ) {
    input.errors.push(
      `${input.option.id} audio path escapes its pair directory.`
    );
    return null;
  }

  return resolvedAudioPath;
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isAac(bytes: Buffer) {
  return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xf0) === 0xf0;
}

function isOgg(bytes: Buffer) {
  return bytes.subarray(0, 4).toString("ascii") === "OggS";
}

function isMp3(bytes: Buffer) {
  return (
    bytes.subarray(0, 3).toString("ascii") === "ID3" ||
    (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)
  );
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
  const [left, right] = [leftPitch, rightPitch].sort(
    (left, right) => left - right
  );

  return `${normalizeCoverageKana(kana)}\t${left}-${right}`;
}

function normalizeCoverageKana(value: string) {
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
