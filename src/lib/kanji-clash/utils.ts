import type { KanjiClashEligibleSubject } from "./types.ts";
import { stripInlineMarkdown } from "../inline-markdown.ts";

const kanjiPattern = /[\p{Script=Han}々〆ヵヶ]/gu;

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

export function collectKanjiFromSurfaces(surfaces: string[]) {
  return dedupeStable(
    surfaces.flatMap((surface) => extractKanjiFromText(surface))
  );
}

export function buildKanjiClashPairKey(
  leftSubjectKey: string,
  rightSubjectKey: string
) {
  return [leftSubjectKey, rightSubjectKey]
    .sort((left, right) => left.localeCompare(right))
    .join("::");
}

export function getSharedKanji(
  left: Pick<KanjiClashEligibleSubject, "kanji">,
  right: Pick<KanjiClashEligibleSubject, "kanji">
) {
  const rightKanji = new Set(right.kanji);

  return left.kanji.filter((kanji) => rightKanji.has(kanji));
}

export function hasSharedNormalizedSurface(
  left: Pick<KanjiClashEligibleSubject, "surfaceForms">,
  right: Pick<KanjiClashEligibleSubject, "surfaceForms">
) {
  return hasIntersection(
    left.surfaceForms,
    right.surfaceForms,
    normalizeKanjiClashSurface
  );
}

export function hasSharedComparisonSurface(
  left: Pick<KanjiClashEligibleSubject, "surfaceForms">,
  right: Pick<KanjiClashEligibleSubject, "surfaceForms">
) {
  return hasIntersection(
    left.surfaceForms,
    right.surfaceForms,
    normalizeKanjiClashComparisonSurface
  );
}

export function hasQualifiedContainedCloneSurface(
  left: Pick<KanjiClashEligibleSubject, "surfaceForms">,
  right: Pick<KanjiClashEligibleSubject, "surfaceForms">
) {
  return left.surfaceForms.some((leftSurface) =>
    right.surfaceForms.some((rightSurface) =>
      isQualifiedContainedCloneSurface(leftSurface, rightSurface)
    )
  );
}

export function hasSharedReading(
  left: Pick<KanjiClashEligibleSubject, "readingForms">,
  right: Pick<KanjiClashEligibleSubject, "readingForms">
) {
  return hasIntersection(
    left.readingForms,
    right.readingForms,
    normalizeKanjiClashSurface
  );
}

export function orderKanjiClashSubjects<T extends { subjectKey: string }>(
  left: T,
  right: T
): [T, T] {
  return left.subjectKey.localeCompare(right.subjectKey) <= 0
    ? [left, right]
    : [right, left];
}

export function hashKanjiClashString(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }

  return hash >>> 0;
}

function hasIntersection(
  leftValues: string[],
  rightValues: string[],
  normalize: (value: string) => string
) {
  const normalizedRight = new Set(
    rightValues
      .map((value) => normalize(value))
      .filter((value) => value.length > 0)
  );

  return leftValues.some((value) => {
    const normalized = normalize(value);

    return normalized.length > 0 && normalizedRight.has(normalized);
  });
}

function isQualifiedContainedCloneSurface(leftValue: string, rightValue: string) {
  const left = normalizeKanjiClashSurface(leftValue);
  const right = normalizeKanjiClashSurface(rightValue);

  if (left.length === 0 || right.length === 0 || left === right) {
    return false;
  }

  const shorter = left.length < right.length ? left : right;
  const longer = shorter === left ? right : left;
  const shorterKanji = extractKanjiFromText(shorter);

  if (shorterKanji.length === 0) {
    return false;
  }

  const longerKanji = new Set(extractKanjiFromText(longer));

  if (!shorterKanji.every((kanji) => longerKanji.has(kanji))) {
    return false;
  }

  return (
    (longer.startsWith(shorter) &&
      isSmallEdgeQualifier(longer.slice(shorter.length))) ||
    (longer.endsWith(shorter) &&
      isSmallEdgeQualifier(longer.slice(0, longer.length - shorter.length)))
  );
}

function isSmallEdgeQualifier(value: string) {
  const qualifier = normalizeKanjiClashSurface(value);

  if (qualifier.length === 0) {
    return false;
  }

  if (
    /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(qualifier) &&
    countCodePoints(qualifier) <= 4
  ) {
    return true;
  }

  return (
    /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(
      qualifier
    ) &&
    countCodePoints(qualifier) >= 2 &&
    countCodePoints(qualifier) <= 5 &&
    extractKanjiFromText(qualifier).length <= 2
  );
}

function countCodePoints(value: string) {
  return [...value].length;
}

function dedupeStable(values: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    deduped.push(value);
  }

  return deduped;
}
