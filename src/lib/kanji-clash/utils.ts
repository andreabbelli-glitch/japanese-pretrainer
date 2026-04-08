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
  return dedupeStable(surfaces.flatMap((surface) => extractKanjiFromText(surface)));
}

export function buildKanjiClashPairKey(leftSubjectKey: string, rightSubjectKey: string) {
  return [leftSubjectKey, rightSubjectKey].sort((left, right) =>
    left.localeCompare(right)
  ).join("::");
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
  return hasIntersection(left.surfaceForms, right.surfaceForms, normalizeKanjiClashSurface);
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

export function hasSharedReading(
  left: Pick<KanjiClashEligibleSubject, "readingForms">,
  right: Pick<KanjiClashEligibleSubject, "readingForms">
) {
  return hasIntersection(left.readingForms, right.readingForms, normalizeKanjiClashSurface);
}

export function orderKanjiClashSubjects<T extends { subjectKey: string }>(
  left: T,
  right: T
): [T, T] {
  return left.subjectKey.localeCompare(right.subjectKey) <= 0
    ? [left, right]
    : [right, left];
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
