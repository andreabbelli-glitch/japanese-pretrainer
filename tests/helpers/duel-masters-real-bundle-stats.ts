import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export interface DuelMastersRealBundleStats {
  parser: {
    lessons: number;
    cardFiles: number;
    terms: number;
    grammarPatterns: number;
    cards: number;
    references: number;
  };
  importer: {
    term: number;
    termAlias: number;
    grammarPattern: number;
    grammarAlias: number;
    entryLink: number;
    card: number;
    cardEntryLink: number;
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const duelMastersRealBundleStatsPath = path.join(
  __dirname,
  "..",
  "fixtures",
  "content",
  "duel-masters-real-bundle-stats.json"
);

export async function readDuelMastersRealBundleStats() {
  const source = await readFile(duelMastersRealBundleStatsPath, "utf8");

  return JSON.parse(source) as DuelMastersRealBundleStats;
}
