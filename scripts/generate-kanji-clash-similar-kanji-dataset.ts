import { writeFile } from "node:fs/promises";
import path from "node:path";

import { buildSimilarKanjiDataset } from "../src/lib/kanji-clash/similar-kanji-dataset-builder.ts";
import {
  KANJI_CLASH_SIMILAR_KANJI_MANUAL_EXCLUDES,
  KANJI_CLASH_SIMILAR_KANJI_MANUAL_INCLUDES
} from "../src/lib/kanji-clash/similar-kanji-overrides.ts";

const WHITE_RABBIT_URL =
  "https://lars.yencken.org/datasets/kanji-confusion/flashcards.csv";
const STROKE_EDIT_DISTANCE_URL =
  "https://lars.yencken.org/datasets/kanji-confusion/jyouyou__strokeEditDistance.csv";
const YEH_AND_LI_RADICAL_URL =
  "https://lars.yencken.org/datasets/kanji-confusion/jyouyou__yehAndLiRadical.csv";
const SIMILAR_KANJI_DATASET_OUTPUT = path.resolve(
  process.cwd(),
  "src/lib/kanji-clash/similar-kanji-dataset.generated.json"
);
const SIMILAR_KANJI_RULES_VERSION = 1;
const SIMILAR_KANJI_MINIMUM_METRIC_SCORE = 0.75;

async function main() {
  const [whiteRabbitText, strokeText, radicalText] = await Promise.all([
    fetchDatasetText(WHITE_RABBIT_URL),
    fetchDatasetText(STROKE_EDIT_DISTANCE_URL),
    fetchDatasetText(YEH_AND_LI_RADICAL_URL)
  ]);
  const dataset = buildSimilarKanjiDataset({
    generatedAt: new Date().toISOString(),
    manualExcludes: KANJI_CLASH_SIMILAR_KANJI_MANUAL_EXCLUDES,
    manualIncludes: KANJI_CLASH_SIMILAR_KANJI_MANUAL_INCLUDES,
    minimumMetricScore: SIMILAR_KANJI_MINIMUM_METRIC_SCORE,
    rulesVersion: SIMILAR_KANJI_RULES_VERSION,
    strokeEditDistance: parseMetricDataset(strokeText),
    whiteRabbit: parseWhiteRabbitDataset(whiteRabbitText),
    yehAndLiRadical: parseMetricDataset(radicalText)
  });

  await writeFile(
    SIMILAR_KANJI_DATASET_OUTPUT,
    `${JSON.stringify(dataset, null, 2)}\n`,
    "utf8"
  );

  console.log(
    `Wrote ${dataset.swaps.length} similar-kanji swaps to ${SIMILAR_KANJI_DATASET_OUTPUT}`
  );
}

async function fetchDatasetText(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`
    );
  }

  return response.text();
}

function parseWhiteRabbitDataset(input: string) {
  const swaps = new Set<string>();

  for (const line of input.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const match = trimmed.match(/^\d+\s+(\S+)\s+(\S+)$/u);

    if (!match) {
      continue;
    }

    const [, pivot, distractors] = match;

    for (const distractor of [...distractors]) {
      if (distractor === pivot) {
        continue;
      }

      swaps.add(
        [pivot, distractor]
          .sort((left, right) => left.localeCompare(right))
          .join("\u0000")
      );
    }
  }

  return [...swaps]
    .map((item) => {
      const [leftKanji, rightKanji] = item.split("\u0000");

      return [leftKanji, rightKanji] as const;
    })
    .sort((left, right) =>
      left[0] === right[0]
        ? left[1].localeCompare(right[1])
        : left[0].localeCompare(right[0])
    );
}

function parseMetricDataset(input: string) {
  const entries: Array<readonly [string, string, number]> = [];

  for (const line of input.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const parts = trimmed.split(/\s+/u);

    if (parts.length < 3) {
      continue;
    }

    const pivot = parts[0];

    for (let index = 1; index < parts.length - 1; index += 2) {
      const target = parts[index];
      const rawScore = parts[index + 1];

      if (!target || !rawScore) {
        continue;
      }

      const score = Number.parseFloat(rawScore);

      if (!Number.isFinite(score) || target === pivot) {
        continue;
      }

      const [leftKanji, rightKanji] = [pivot, target].sort((left, right) =>
        left.localeCompare(right)
      );

      entries.push([leftKanji, rightKanji, score] as const);
    }
  }

  return dedupeMetricEntries(entries);
}

function dedupeMetricEntries(
  entries: Array<readonly [string, string, number]>
) {
  const scoresByKey = new Map<string, number>();

  for (const [leftKanji, rightKanji, score] of entries) {
    const key = `${leftKanji}\u0000${rightKanji}`;
    const existing = scoresByKey.get(key) ?? Number.NEGATIVE_INFINITY;

    if (score > existing) {
      scoresByKey.set(key, score);
    }
  }

  return [...scoresByKey.entries()]
    .map(([key, score]) => {
      const [leftKanji, rightKanji] = key.split("\u0000");

      return [leftKanji, rightKanji, score] as const;
    })
    .sort((left, right) => {
      const leftKey = `${left[0]}${left[1]}`;
      const rightKey = `${right[0]}${right[1]}`;

      return leftKey.localeCompare(rightKey);
    });
}

await main();
