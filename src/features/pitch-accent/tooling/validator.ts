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
  const errors: string[] = [];
  const corpus = await readManifest(input.outDir, errors);

  await requireFile(input.outDir, "LICENSE-GPL-3.0.txt", errors);
  await requireFile(input.outDir, "NOTICE.md", errors);

  if (!corpus) {
    return { errors, ok: false };
  }

  errors.push(...validatePitchAccentMinimalPairsCorpus(corpus).errors);

  for (const pair of corpus.pairs) {
    for (const option of pair.options) {
      await validateAudioOption(input.outDir, pair.id, option, errors);
    }
  }

  return {
    errors,
    ok: errors.length === 0
  };
}

async function readManifest(outDir: string, errors: string[]) {
  try {
    return JSON.parse(
      await readFile(path.join(outDir, "manifest.json"), "utf8")
    ) as PitchAccentMinimalPairsCorpus;
  } catch (error) {
    errors.push(
      error instanceof Error
        ? `Unable to read manifest.json: ${error.message}`
        : "Unable to read manifest.json."
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

async function validateAudioOption(
  outDir: string,
  pairId: string,
  option: PitchAccentPairOption,
  errors: string[]
) {
  const audioPath = resolveAudioPath(outDir, pairId, option, errors);
  let bytes: Buffer;

  if (!audioPath) {
    return;
  }

  try {
    bytes = await readFile(audioPath);
  } catch {
    errors.push(`Missing audio file for ${option.id}.`);
    return;
  }

  if (option.byteLength !== undefined && option.byteLength !== bytes.length) {
    errors.push(`${option.id} byte length does not match manifest.`);
  }
  if (option.audioSha256 && option.audioSha256 !== sha256(bytes)) {
    errors.push(`${option.id} SHA-256 does not match manifest.`);
  }
  if (option.audioMime === "audio/aac" && !isAac(bytes)) {
    errors.push(`${option.id} audio MIME does not match AAC magic bytes.`);
  }
  if (option.audioMime === "audio/ogg" && !isOgg(bytes)) {
    errors.push(`${option.id} audio MIME does not match OGG magic bytes.`);
  }
}

function resolveAudioPath(
  outDir: string,
  pairId: string,
  option: PitchAccentPairOption,
  errors: string[]
) {
  const prefix = "/vendor/minimal-pairs/";
  if (!isSafePitchAccentPairId(pairId)) {
    errors.push(`${option.id} audio path has an unsafe pair id.`);
    return null;
  }
  if (!option.audioSrc.startsWith(prefix)) {
    errors.push(`${option.id} audio path does not use the vendor prefix.`);
    return null;
  }

  const relativeAudioPath = option.audioSrc.slice(prefix.length);
  if (relativeAudioPath.includes("\\")) {
    errors.push(`${option.id} audio path contains an invalid separator.`);
    return null;
  }
  const pathSegments = relativeAudioPath.split("/");
  if (
    pathSegments.length < 3 ||
    pathSegments.some(
      (segment) => segment === "" || segment === "." || segment === ".."
    ) ||
    pathSegments[0] !== "audio" ||
    pathSegments[1] !== pairId
  ) {
    errors.push(`${option.id} audio path escapes its pair directory.`);
    return null;
  }

  const resolvedOutDir = path.resolve(outDir);
  const resolvedAudioPath = path.resolve(resolvedOutDir, ...pathSegments);
  const resolvedPairDir = path.resolve(resolvedOutDir, "audio", pairId);
  const relativeToOutDir = path.relative(resolvedOutDir, resolvedAudioPath);
  const relativeToPairDir = path.relative(resolvedPairDir, resolvedAudioPath);

  if (
    relativeToOutDir === "" ||
    relativeToOutDir.startsWith("..") ||
    path.isAbsolute(relativeToOutDir)
  ) {
    errors.push(`${option.id} audio path escapes the corpus directory.`);
    return null;
  }

  if (
    relativeToPairDir === "" ||
    relativeToPairDir.startsWith("..") ||
    path.isAbsolute(relativeToPairDir)
  ) {
    errors.push(`${option.id} audio path escapes its pair directory.`);
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
