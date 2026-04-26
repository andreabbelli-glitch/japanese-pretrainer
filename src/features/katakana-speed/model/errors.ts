import type { KatakanaSpeedErrorTag } from "../types.ts";
import {
  getKatakanaSpeedConfusionClusters,
  getKatakanaSpeedItemBySurface
} from "./catalog.ts";

const smallToLarge = new Map([
  ["ァ", "ア"],
  ["ィ", "イ"],
  ["ゥ", "ウ"],
  ["ェ", "エ"],
  ["ォ", "オ"],
  ["ャ", "ヤ"],
  ["ュ", "ユ"],
  ["ョ", "ヨ"]
]);

export function classifyKatakanaSpeedError(input: {
  actualSurface: string;
  expectedSurface: string;
  responseMs: number;
  targetRtMs: number;
}): KatakanaSpeedErrorTag[] {
  if (input.actualSurface === input.expectedSurface) {
    return input.responseMs > input.targetRtMs ? ["slow_correct"] : [];
  }

  if (expandSmallKana(input.expectedSurface) === input.actualSurface) {
    return ["small_kana_ignored"];
  }

  if (input.expectedSurface.includes("ー")) {
    const withoutLongVowel = input.expectedSurface.replaceAll("ー", "");
    if (withoutLongVowel === input.actualSurface) {
      return ["long_vowel_missed"];
    }
  }

  if (input.expectedSurface.includes("ッ")) {
    const withoutSokuon = input.expectedSurface.replaceAll("ッ", "");
    if (withoutSokuon === input.actualSurface) {
      return ["sokuon_missed"];
    }
  }

  const confusionKind = findSharedConfusionKind(
    input.expectedSurface,
    input.actualSurface
  );
  if (confusionKind === "visual") {
    return ["visual_confusion"];
  }
  if (confusionKind === "phonological") {
    return ["phonological_confusion"];
  }

  return ["unclassified_error"];
}

function expandSmallKana(value: string) {
  return [...value].map((char) => smallToLarge.get(char) ?? char).join("");
}

function findSharedConfusionKind(
  expectedSurface: string,
  actualSurface: string
) {
  const expectedItem = getKatakanaSpeedItemBySurface(expectedSurface);
  const actualItem = getKatakanaSpeedItemBySurface(actualSurface);
  if (!expectedItem || !actualItem) {
    return null;
  }

  return (
    getKatakanaSpeedConfusionClusters().find(
      (cluster) =>
        cluster.itemIds.includes(expectedItem.id) &&
        cluster.itemIds.includes(actualItem.id)
    )?.kind ?? null
  );
}
