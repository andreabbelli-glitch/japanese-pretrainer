import { stripInlineMarkdown } from "@/features/study/model/inline-markdown";

import { dedupeStable } from "./shared-utils.ts";

const kanjiPattern = /[\p{Script=Han}々〆ヵヶ]/gu;
const kanaOnlyPattern = /^[\p{Script=Hiragana}\p{Script=Katakana}ー〜]+$/u;
const phrasePunctuationPattern = /[!?！？。]/u;
const phraseParticlePattern =
  /[\p{Script=Han}々〆ヵヶ\p{Script=Hiragana}\p{Script=Katakana}ー](から|まで|より|によって|により|について|として|を|に|へ|で|と|が|は|も|の)[\p{Script=Han}々〆ヵヶ\p{Script=Hiragana}\p{Script=Katakana}ー]/u;
const leadingLightQualifierPattern =
  /^[\p{Script=Hiragana}\p{Script=Katakana}ー]{2,}[\p{Script=Han}々〆ヵヶ]/u;
const trailingKatakanaQualifierPattern =
  /[\p{Script=Han}々〆ヵヶ][\p{Script=Katakana}ー]{2,}$/u;

export function normalizeKanjiClashSurface(value: string) {
  return stripInlineMarkdown(value)
    .normalize("NFKC")
    .replace(/[～〜]/g, "〜")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeKanjiClashComparisonSurface(value: string) {
  return normalizeKanjiClashSurface(value).replace(/[\p{P}\p{S}\s]/gu, "");
}

export function extractKanjiFromText(value: string) {
  const matches = normalizeKanjiClashSurface(value).match(kanjiPattern) ?? [];

  return dedupeStable(matches);
}

export function isKanjiClashKanjiCharacter(value: string) {
  return /^[\p{Script=Han}々〆ヵヶ]$/u.test(value);
}

export function splitKanjiClashSurfaceIntoCodePoints(value: string) {
  return [...normalizeKanjiClashSurface(value)];
}

export function collectKanjiFromSurfaces(surfaces: string[]) {
  return dedupeStable(
    surfaces.flatMap((surface) => extractKanjiFromText(surface))
  );
}

export function isEligibleKanjiClashCardFront(value: string) {
  const normalized = normalizeKanjiClashSurface(value);

  if (normalized.length === 0) {
    return false;
  }

  if (normalized.includes(" ")) {
    return false;
  }

  if (phrasePunctuationPattern.test(normalized)) {
    return false;
  }

  if (kanaOnlyPattern.test(normalized)) {
    return false;
  }

  if (phraseParticlePattern.test(normalized)) {
    return false;
  }

  if (leadingLightQualifierPattern.test(normalized)) {
    return false;
  }

  if (trailingKatakanaQualifierPattern.test(normalized)) {
    return false;
  }

  return extractKanjiFromText(normalized).length > 0;
}

export function trimTrailingKanaRun(value: string) {
  return normalizeKanjiClashSurface(value).replace(
    /[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u,
    ""
  );
}

export function containsKana(value: string) {
  return /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(value);
}

export function endsWithKana(value: string) {
  const lastCodePoint = [...value].at(-1);

  return lastCodePoint
    ? /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(lastCodePoint)
    : false;
}

export function countCodePoints(value: string) {
  return [...value].length;
}

export function normalizeKanaReading(value: string) {
  return normalizeKanjiClashSurface(value).replace(
    /[\u30a1-\u30f6]/g,
    (character) => String.fromCharCode(character.charCodeAt(0) - 0x60)
  );
}
