import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  validatePitchAccentMinimalPairsCorpus,
  type PitchAccentMinimalPairsCorpus
} from "../model";

const manifestPath = path.join(
  process.cwd(),
  "public",
  "vendor",
  "minimal-pairs",
  "manifest.json"
);

let corpusCache: Promise<PitchAccentMinimalPairsCorpus> | null = null;

export async function loadPitchAccentMinimalPairsCorpus() {
  corpusCache ??= readPitchAccentMinimalPairsCorpus(manifestPath);

  return corpusCache;
}

export async function readPitchAccentMinimalPairsCorpus(sourcePath: string) {
  const source = await readFile(sourcePath, "utf8");
  const corpus = JSON.parse(source) as PitchAccentMinimalPairsCorpus;
  const validation = validatePitchAccentMinimalPairsCorpus(corpus);

  if (!validation.ok) {
    throw new Error(
      `Pitch accent minimal-pairs corpus is invalid: ${validation.errors.join(
        "; "
      )}`
    );
  }

  return corpus;
}
