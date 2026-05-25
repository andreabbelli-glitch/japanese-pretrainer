import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  validatePitchAccentMinimalPairsCorpus,
  type PitchAccentMinimalPairsCorpus
} from "../model";

type PitchAccentCorpusSpec = {
  readonly allowedAudioSrcPrefixes: readonly string[];
  readonly manifestPath: string;
  readonly required: boolean;
};

const corpusSpecs: readonly PitchAccentCorpusSpec[] = [
  {
    allowedAudioSrcPrefixes: ["/vendor/minimal-pairs/audio/"],
    manifestPath: path.join(
      process.cwd(),
      "public",
      "vendor",
      "minimal-pairs",
      "manifest.json"
    ),
    required: true
  },
  {
    allowedAudioSrcPrefixes: ["/vendor/tofugu-pitch-minimal-pairs/audio/"],
    manifestPath: path.join(
      process.cwd(),
      "public",
      "vendor",
      "tofugu-pitch-minimal-pairs",
      "manifest.json"
    ),
    required: false
  }
];

const runtimeExcludedPairIds = new Set([
  // Kuuuube ze is the しのぶ pitch1/pitch2 pair; it is lexically ambiguous
  // with 忍ぶ/偲ぶ and has produced unreliable drill answers in practice.
  "ze"
]);

let corpusCache: Promise<PitchAccentMinimalPairsCorpus> | null = null;

export async function loadPitchAccentMinimalPairsCorpus() {
  corpusCache ??= readPitchAccentMinimalPairCorpusSpecs(corpusSpecs);

  return corpusCache;
}

export async function readPitchAccentMinimalPairCorpusSpecs(
  specs: readonly PitchAccentCorpusSpec[]
) {
  const corpora: PitchAccentMinimalPairsCorpus[] = [];

  for (const spec of specs) {
    const corpus = await readOptionalPitchAccentMinimalPairsCorpus(spec);

    if (corpus) {
      corpora.push(corpus);
    }
  }

  if (corpora.length === 0) {
    throw new Error("No pitch accent minimal-pairs corpora were found.");
  }

  if (corpora.length === 1) {
    return excludeRuntimePitchAccentPairs(corpora[0]!);
  }

  return excludeRuntimePitchAccentPairs(
    mergePitchAccentMinimalPairsCorpora(corpora)
  );
}

export async function readPitchAccentMinimalPairsCorpus(
  sourcePath: string,
  options: {
    readonly allowedAudioSrcPrefixes?: readonly string[];
  } = {}
) {
  const source = await readFile(sourcePath, "utf8");
  const corpus = JSON.parse(source) as PitchAccentMinimalPairsCorpus;
  const validation = validatePitchAccentMinimalPairsCorpus(corpus, {
    allowedAudioSrcPrefixes: options.allowedAudioSrcPrefixes
  });

  if (!validation.ok) {
    throw new Error(
      `Pitch accent minimal-pairs corpus is invalid: ${validation.errors.join(
        "; "
      )}`
    );
  }

  return corpus;
}

async function readOptionalPitchAccentMinimalPairsCorpus(
  spec: PitchAccentCorpusSpec
) {
  try {
    return await readPitchAccentMinimalPairsCorpus(spec.manifestPath, {
      allowedAudioSrcPrefixes: spec.allowedAudioSrcPrefixes
    });
  } catch (error) {
    if (!spec.required && isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

function mergePitchAccentMinimalPairsCorpora(
  corpora: readonly PitchAccentMinimalPairsCorpus[]
): PitchAccentMinimalPairsCorpus {
  const importedAt = corpora
    .map((corpus) => corpus.source.importedAt)
    .sort()
    .at(-1);

  return {
    pairs: corpora.flatMap((corpus) => corpus.pairs),
    source: {
      importedAt: importedAt ?? new Date(0).toISOString(),
      license: corpora.map((corpus) => corpus.source.license).join("+"),
      repository: "merged-static-corpora",
      revision: corpora.map((corpus) => corpus.source.revision).join("+")
    },
    version: 1
  };
}

function excludeRuntimePitchAccentPairs(
  corpus: PitchAccentMinimalPairsCorpus
): PitchAccentMinimalPairsCorpus {
  const pairs = corpus.pairs.filter(
    (pair) => !runtimeExcludedPairIds.has(pair.id)
  );

  return pairs.length === corpus.pairs.length ? corpus : { ...corpus, pairs };
}

function isMissingFileError(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
