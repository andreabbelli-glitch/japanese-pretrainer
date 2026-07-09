import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import type { DailyKanjiDataset } from "../src/features/daily-kanji/types.ts";
import { buildDailyKanjiAudioBundleFileName } from "../src/features/daily-kanji/server/audio-packager.ts";

type VerificationInput = {
  allowStale?: boolean;
  iosRoot: string;
  maxAgeHours?: number;
  minCards?: number;
  now?: Date;
};

const defaultMaxAgeHours = 96;
const defaultMinCards = 2;
const playableAudioExtensions = new Set([".aac", ".m4a", ".mp3", ".wav"]);
const sampleCardIds = new Set(["sample-kanji"]);

class DailyKanjiResourceVerificationError extends Error {}

export async function verifyDailyKanjiIosResources(input: VerificationInput) {
  const iosRoot = path.resolve(input.iosRoot);
  const datasetPath = path.join(
    iosRoot,
    "App",
    "Resources",
    "daily-kanji-cards.json"
  );
  const audioRoot = path.join(iosRoot, "App", "Resources", "Audio");
  const widgetDatasetPath = path.join(
    iosRoot,
    "WidgetExtension",
    "Resources",
    "daily-kanji-widget-cards.json"
  );
  const maxAgeHours = input.maxAgeHours ?? defaultMaxAgeHours;
  const minCards = input.minCards ?? defaultMinCards;
  const now = input.now ?? new Date();
  const dataset = await readDataset(datasetPath, "app");
  const widgetDataset = await readDataset(widgetDatasetPath, "widget");

  validateDatasetShape(dataset, minCards);
  validateWidgetDataset(widgetDataset, dataset);
  validateGeneratedAt(dataset.generatedAt, {
    allowStale: input.allowStale,
    maxAgeHours,
    now
  });
  await validateAudioResources(dataset, audioRoot);

  return {
    audioReferences: countPlayableAudioReferences(dataset),
    cards: dataset.cards.length,
    generatedAt: dataset.generatedAt,
    widgetCards: widgetDataset.cards.length
  };
}

async function readDataset(
  datasetPath: string,
  target: "app" | "widget"
): Promise<DailyKanjiDataset> {
  let raw: string;
  try {
    raw = await readFile(datasetPath, "utf8");
  } catch {
    throw new DailyKanjiResourceVerificationError(
      `Missing Daily Kanji iOS ${target} dataset: ${datasetPath}\nRun ./scripts/with-node.sh pnpm daily-kanji:package before building the iOS app.`
    );
  }

  try {
    return JSON.parse(raw) as DailyKanjiDataset;
  } catch {
    throw new DailyKanjiResourceVerificationError(
      `Invalid Daily Kanji iOS ${target} dataset JSON: ${datasetPath}`
    );
  }
}

function validateWidgetDataset(
  widgetDataset: DailyKanjiDataset,
  appDataset: DailyKanjiDataset
) {
  if (Object.hasOwn(widgetDataset, "glossary")) {
    throw new DailyKanjiResourceVerificationError(
      "Daily Kanji widget dataset must not contain the full glossary snapshot. Run ./scripts/with-node.sh pnpm daily-kanji:package."
    );
  }

  const expectedWidgetDataset = { ...appDataset };
  delete expectedWidgetDataset.glossary;
  if (!isDeepStrictEqual(widgetDataset, expectedWidgetDataset)) {
    throw new DailyKanjiResourceVerificationError(
      "Daily Kanji widget dataset does not match the cards-only projection of the app dataset. Run ./scripts/with-node.sh pnpm daily-kanji:package."
    );
  }
}

function validateDatasetShape(dataset: DailyKanjiDataset, minCards: number) {
  if (dataset.version !== 1) {
    throw new DailyKanjiResourceVerificationError(
      `Unsupported Daily Kanji dataset version: ${String(dataset.version)}`
    );
  }

  if (!Array.isArray(dataset.cards) || dataset.cards.length < minCards) {
    throw new DailyKanjiResourceVerificationError(
      `Daily Kanji dataset has ${dataset.cards?.length ?? 0} card(s); expected at least ${minCards}. Run ./scripts/with-node.sh pnpm daily-kanji:package.`
    );
  }

  const sampleCard = dataset.cards.find(
    (card) =>
      sampleCardIds.has(card.cardId) ||
      card.notes === "Sample card shown until the personal dataset is exported."
  );
  if (sampleCard) {
    throw new DailyKanjiResourceVerificationError(
      `Daily Kanji dataset still contains sample card ${sampleCard.cardId}. Run ./scripts/with-node.sh pnpm daily-kanji:package.`
    );
  }
}

function validateGeneratedAt(
  generatedAt: string,
  input: { allowStale?: boolean; maxAgeHours: number; now: Date }
) {
  const generatedDate = new Date(generatedAt);
  if (Number.isNaN(generatedDate.valueOf())) {
    throw new DailyKanjiResourceVerificationError(
      `Daily Kanji dataset has invalid generatedAt: ${generatedAt}`
    );
  }

  const futureToleranceMs = 5 * 60 * 1000;
  if (generatedDate.getTime() - input.now.getTime() > futureToleranceMs) {
    throw new DailyKanjiResourceVerificationError(
      `Daily Kanji dataset generatedAt is in the future: ${generatedAt}`
    );
  }

  if (input.allowStale) {
    return;
  }

  const ageHours =
    (input.now.getTime() - generatedDate.getTime()) / (60 * 60 * 1000);
  if (ageHours > input.maxAgeHours) {
    throw new DailyKanjiResourceVerificationError(
      `Daily Kanji dataset is stale (${ageHours.toFixed(1)}h old; max ${input.maxAgeHours}h). Run ./scripts/with-node.sh pnpm daily-kanji:package or set DAILY_KANJI_ALLOW_STALE_RESOURCES=1 for an intentional stale build.`
    );
  }
}

async function validateAudioResources(
  dataset: DailyKanjiDataset,
  audioRoot: string
) {
  const references = collectPlayableAudioReferences(dataset);
  if (references.length === 0) {
    return;
  }

  await assertFileExists(
    path.join(audioRoot, ".daily-kanji-audio-generated"),
    "Missing generated Daily Kanji audio marker. Run ./scripts/with-node.sh pnpm daily-kanji:package."
  );

  const missing: string[] = [];
  for (const reference of references) {
    const fileName = buildDailyKanjiAudioBundleFileName(reference);
    try {
      await access(path.join(audioRoot, fileName));
    } catch {
      missing.push(`${reference.cardId}: ${fileName}`);
    }
  }

  if (missing.length > 0) {
    throw new DailyKanjiResourceVerificationError(
      [
        "Missing packaged Daily Kanji audio resource(s):",
        ...missing.slice(0, 12).map((item) => `- ${item}`),
        missing.length > 12 ? `- ...and ${missing.length - 12} more` : "",
        "Run ./scripts/with-node.sh pnpm daily-kanji:package."
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const audioEntries = await readdir(audioRoot);
  if (audioEntries.length <= 1) {
    throw new DailyKanjiResourceVerificationError(
      "Daily Kanji audio directory contains only the generated marker. Run ./scripts/with-node.sh pnpm daily-kanji:package."
    );
  }
}

async function assertFileExists(filePath: string, message: string) {
  try {
    await access(filePath);
  } catch {
    throw new DailyKanjiResourceVerificationError(message);
  }
}

function countPlayableAudioReferences(dataset: DailyKanjiDataset) {
  return collectPlayableAudioReferences(dataset).length;
}

function collectPlayableAudioReferences(dataset: DailyKanjiDataset) {
  return dataset.cards.flatMap((card) => {
    const audioSrc = card.entry.audioSrc;
    if (!audioSrc) {
      return [];
    }

    const extension = path.extname(audioSrc).toLowerCase();
    if (!playableAudioExtensions.has(extension)) {
      return [];
    }

    return [
      {
        audioSrc,
        cardId: card.cardId,
        mediaSlug: card.media.slug
      }
    ];
  });
}

function parseArgs(argv: string[]) {
  const args = {
    allowStale: process.env.DAILY_KANJI_ALLOW_STALE_RESOURCES === "1",
    iosRoot: path.join(process.cwd(), "apps", "daily-kanji-ios"),
    maxAgeHours: defaultMaxAgeHours,
    minCards: defaultMinCards,
    now: new Date()
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--") {
      continue;
    } else if (arg === "--allow-stale") {
      args.allowStale = true;
    } else if (arg === "--ios-root" && next) {
      args.iosRoot = next;
      index += 1;
    } else if (arg === "--max-age-hours" && next) {
      args.maxAgeHours = parsePositiveNumber(next, arg);
      index += 1;
    } else if (arg === "--min-cards" && next) {
      args.minCards = parsePositiveNumber(next, arg);
      index += 1;
    } else if (arg === "--now-iso" && next) {
      args.now = new Date(next);
      if (Number.isNaN(args.now.valueOf())) {
        throw new DailyKanjiResourceVerificationError(
          `Invalid --now-iso value: ${next}`
        );
      }
      index += 1;
    } else {
      throw new DailyKanjiResourceVerificationError(
        `Unknown or incomplete argument: ${arg}`
      );
    }
  }

  return args;
}

function parsePositiveNumber(value: string, option: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new DailyKanjiResourceVerificationError(
      `Invalid ${option} value: ${value}`
    );
  }

  return parsed;
}

async function main() {
  const result = await verifyDailyKanjiIosResources(
    parseArgs(process.argv.slice(2))
  );
  process.stdout.write(
    `Daily Kanji iOS resources verified: ${result.cards} app card(s), ${result.widgetCards} widget card(s), ${result.audioReferences} playable audio reference(s), generatedAt ${result.generatedAt}\n`
  );
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : "Daily Kanji iOS resource verification failed.";
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
