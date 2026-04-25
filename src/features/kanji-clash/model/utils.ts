import type { KanjiClashEligibleSubject } from "../types.ts";
import { stripInlineMarkdown } from "@/lib/inline-markdown";

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

export function buildKanjiClashPairKey(
  leftSubjectKey: string,
  rightSubjectKey: string
) {
  return [leftSubjectKey, rightSubjectKey]
    .sort((left, right) => left.localeCompare(right))
    .join("::");
}

export function buildKanjiClashContrastKey(
  leftEndpointKey: string,
  rightEndpointKey: string
) {
  return buildKanjiClashPairKey(leftEndpointKey, rightEndpointKey);
}

export function buildKanjiClashContrastRoundKey(
  contrastKey: string,
  targetEndpointKey: string
) {
  return `${contrastKey}::target:${targetEndpointKey}`;
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

export function hasSharedLexicalCoreSurface(
  left: Pick<KanjiClashEligibleSubject, "surfaceForms">,
  right: Pick<KanjiClashEligibleSubject, "surfaceForms">
) {
  return left.surfaceForms.some((leftSurface) =>
    right.surfaceForms.some((rightSurface) =>
      isSharedLexicalCoreSurface(leftSurface, rightSurface)
    )
  );
}

export function hasSharedContextualPrefixSurface(
  left: Pick<KanjiClashEligibleSubject, "surfaceForms">,
  right: Pick<KanjiClashEligibleSubject, "surfaceForms">
) {
  return left.surfaceForms.some((leftSurface) =>
    right.surfaceForms.some((rightSurface) =>
      isSharedContextualPrefixSurface(leftSurface, rightSurface)
    )
  );
}

export function hasContextualizedHeadFamilySurface(
  left: Pick<KanjiClashEligibleSubject, "surfaceForms">,
  right: Pick<KanjiClashEligibleSubject, "surfaceForms">
) {
  return left.surfaceForms.some((leftSurface) =>
    right.surfaceForms.some((rightSurface) =>
      isContextualizedHeadFamilySurface(leftSurface, rightSurface)
    )
  );
}

export function hasCrossEdgeMixedStemSurface(
  left: Pick<KanjiClashEligibleSubject, "surfaceForms">,
  right: Pick<KanjiClashEligibleSubject, "surfaceForms">
) {
  return left.surfaceForms.some((leftSurface) =>
    right.surfaceForms.some((rightSurface) =>
      isCrossEdgeMixedStemSurface(leftSurface, rightSurface)
    )
  );
}

export function hasSameKanjiCoreReadingSurface(
  left: Pick<KanjiClashEligibleSubject, "surfaceForms" | "readingForms">,
  right: Pick<KanjiClashEligibleSubject, "surfaceForms" | "readingForms">
) {
  return left.surfaceForms.some((leftSurface) =>
    right.surfaceForms.some((rightSurface) =>
      left.readingForms.some((leftReading) =>
        right.readingForms.some((rightReading) =>
          isSameKanjiCoreReadingSurface(
            leftSurface,
            rightSurface,
            leftReading,
            rightReading
          )
        )
      )
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

function isQualifiedContainedCloneSurface(
  leftValue: string,
  rightValue: string
) {
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

function isSharedLexicalCoreSurface(leftValue: string, rightValue: string) {
  const left = normalizeKanjiClashSurface(leftValue);
  const right = normalizeKanjiClashSurface(rightValue);

  if (left.length === 0 || right.length === 0 || left === right) {
    return false;
  }

  return (
    hasQualifiedSharedSuffixHead(left, right) ||
    hasQualifiedSharedMixedStem(left, right)
  );
}

function isSharedContextualPrefixSurface(
  leftValue: string,
  rightValue: string
) {
  const left = normalizeKanjiClashSurface(leftValue);
  const right = normalizeKanjiClashSurface(rightValue);

  if (left.length === 0 || right.length === 0 || left === right) {
    return false;
  }

  const prefix = getLongestCommonPrefix(left, right);

  if (
    countCodePoints(prefix) < 3 ||
    extractKanjiFromText(prefix).length < 2 ||
    !endsWithKana(prefix)
  ) {
    return false;
  }

  const leftTail = left.slice(prefix.length);
  const rightTail = right.slice(prefix.length);

  return (
    isSubstantialPhraseTail(leftTail) && isSubstantialPhraseTail(rightTail)
  );
}

function isContextualizedHeadFamilySurface(
  leftValue: string,
  rightValue: string
) {
  const left = normalizeKanjiClashSurface(leftValue);
  const right = normalizeKanjiClashSurface(rightValue);

  if (left.length === 0 || right.length === 0 || left === right) {
    return false;
  }

  return (
    matchesContextualizedHeadFamily(left, right) ||
    matchesContextualizedHeadFamily(right, left)
  );
}

function isCrossEdgeMixedStemSurface(leftValue: string, rightValue: string) {
  const left = normalizeKanjiClashSurface(leftValue);
  const right = normalizeKanjiClashSurface(rightValue);

  if (left.length === 0 || right.length === 0 || left === right) {
    return false;
  }

  return (
    matchesCrossEdgeMixedStem(left, right) ||
    matchesCrossEdgeMixedStem(right, left)
  );
}

function isSameKanjiCoreReadingSurface(
  leftValue: string,
  rightValue: string,
  leftReadingValue: string,
  rightReadingValue: string
) {
  const left = normalizeKanjiClashSurface(leftValue);
  const right = normalizeKanjiClashSurface(rightValue);

  if (left.length === 0 || right.length === 0 || left === right) {
    return false;
  }

  const leftVariants = buildKanaVariantKanjiCoreMatches(left);
  const rightVariants = buildKanaVariantKanjiCoreMatches(right);

  return leftVariants.some((leftVariant) =>
    rightVariants.some((rightVariant) => {
      if (
        leftVariant.position !== rightVariant.position ||
        leftVariant.kanjiCore !== rightVariant.kanjiCore ||
        leftVariant.modifier === rightVariant.modifier
      ) {
        return false;
      }

      const leftCoreReading = extractKanjiCoreReading(
        leftVariant,
        leftReadingValue
      );
      const rightCoreReading = extractKanjiCoreReading(
        rightVariant,
        rightReadingValue
      );

      return leftCoreReading.length > 0 && leftCoreReading === rightCoreReading;
    })
  );
}

function matchesCrossEdgeMixedStem(prefixed: string, suffixed: string) {
  const prefixedTrimmed = trimTrailingKanaRun(prefixed);
  const suffixedTrimmed = trimTrailingKanaRun(suffixed);
  const candidateStems = dedupeStable([
    getLongestPrefixAgainstSuffix(prefixed, suffixed),
    getLongestPrefixAgainstSuffix(prefixedTrimmed, suffixedTrimmed)
  ]);

  return candidateStems.some((stem) => {
    if (
      countCodePoints(stem) < 3 ||
      extractKanjiFromText(stem).length < 2 ||
      !containsKana(stem)
    ) {
      return false;
    }

    const prefixedTail = prefixed.slice(stem.length);
    const suffixedHead = suffixedTrimmed.slice(
      0,
      suffixedTrimmed.length - stem.length
    );
    const suffixedTail = suffixed.slice(suffixedHead.length + stem.length);

    return (
      prefixedTrimmed.startsWith(stem) &&
      suffixedTrimmed.endsWith(stem) &&
      isSmallDerivativeTail(prefixedTail) &&
      isSmallLexicalModifier(suffixedHead) &&
      isSmallDerivativeTail(suffixedTail)
    );
  });
}

function matchesContextualizedHeadFamily(contextual: string, bare: string) {
  const splitIndex = contextual.lastIndexOf("の");

  if (splitIndex <= 0) {
    return false;
  }

  const prefix = contextual.slice(0, splitIndex + 1);
  const tail = contextual.slice(splitIndex + 1);
  const common = getLongestCommonPrefix(tail, bare);

  if (
    countCodePoints(prefix) < 2 ||
    extractKanjiFromText(prefix).length < 2 ||
    !endsWithKana(prefix) ||
    countCodePoints(common) < 2
  ) {
    return false;
  }

  const tailRest = tail.slice(common.length);
  const bareRest = bare.slice(common.length);

  return isTinyContrastiveTail(tailRest) && isTinyContrastiveTail(bareRest);
}

function hasQualifiedSharedSuffixHead(left: string, right: string) {
  const suffix = getLongestCommonSuffix(left, right);

  if (extractKanjiFromText(suffix).length < 2) {
    return false;
  }

  const leftPrefix = left.slice(0, left.length - suffix.length);
  const rightPrefix = right.slice(0, right.length - suffix.length);

  return (
    leftPrefix.length > 0 &&
    rightPrefix.length > 0 &&
    isSmallLexicalModifier(leftPrefix) &&
    isSmallLexicalModifier(rightPrefix)
  );
}

function hasQualifiedSharedMixedStem(left: string, right: string) {
  const prefix = getLongestCommonPrefix(left, right);

  if (extractKanjiFromText(prefix).length < 2 || !containsKana(prefix)) {
    return false;
  }

  const leftTail = left.slice(prefix.length);
  const rightTail = right.slice(prefix.length);

  return (
    leftTail.length > 0 &&
    rightTail.length > 0 &&
    isSmallDerivativeTail(leftTail) &&
    isSmallDerivativeTail(rightTail)
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

function isSmallDerivativeTail(value: string) {
  const tail = normalizeKanjiClashSurface(value);

  return (
    tail.length > 0 &&
    /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(tail) &&
    countCodePoints(tail) <= 4 &&
    extractKanjiFromText(tail).length <= 2
  );
}

function isSmallLexicalModifier(value: string) {
  const modifier = normalizeKanjiClashSurface(value);

  return (
    modifier.length > 0 &&
    /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(
      modifier
    ) &&
    countCodePoints(modifier) <= 6 &&
    extractKanjiFromText(modifier).length <= 2
  );
}

function isSubstantialPhraseTail(value: string) {
  const tail = normalizeKanjiClashSurface(value);

  return (
    countCodePoints(tail) >= 2 &&
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(tail)
  );
}

function isTinyContrastiveTail(value: string) {
  const tail = normalizeKanjiClashSurface(value);

  return (
    tail.length > 0 &&
    countCodePoints(tail) <= 2 &&
    extractKanjiFromText(tail).length <= 1
  );
}

function buildKanaVariantKanjiCoreMatches(surface: string) {
  const prefixMatch = surface.match(
    /^([\p{Script=Han}々〆ヵヶ]+)([\p{Script=Hiragana}\p{Script=Katakana}ー]+)$/u
  );
  const suffixMatch = surface.match(
    /^([\p{Script=Hiragana}\p{Script=Katakana}ー]+)([\p{Script=Han}々〆ヵヶ]+)$/u
  );
  const matches: Array<{
    kanjiCore: string;
    modifier: string;
    position: "prefix" | "suffix";
  }> = [];

  if (prefixMatch) {
    matches.push({
      kanjiCore: prefixMatch[1],
      modifier: normalizeKanaReading(prefixMatch[2]),
      position: "prefix"
    });
  }

  if (suffixMatch) {
    matches.push({
      kanjiCore: suffixMatch[2],
      modifier: normalizeKanaReading(suffixMatch[1]),
      position: "suffix"
    });
  }

  return matches;
}

function extractKanjiCoreReading(
  match: {
    modifier: string;
    position: "prefix" | "suffix";
  },
  readingValue: string
) {
  const reading = normalizeKanaReading(readingValue);

  if (reading.length === 0) {
    return "";
  }

  if (match.position === "prefix") {
    return reading.endsWith(match.modifier)
      ? reading.slice(0, reading.length - match.modifier.length)
      : "";
  }

  return reading.startsWith(match.modifier)
    ? reading.slice(match.modifier.length)
    : "";
}

function getLongestCommonPrefix(left: string, right: string) {
  const leftCodePoints = [...left];
  const rightCodePoints = [...right];
  let sharedLength = 0;

  while (
    sharedLength < leftCodePoints.length &&
    sharedLength < rightCodePoints.length &&
    leftCodePoints[sharedLength] === rightCodePoints[sharedLength]
  ) {
    sharedLength += 1;
  }

  return leftCodePoints.slice(0, sharedLength).join("");
}

function getLongestCommonSuffix(left: string, right: string) {
  const leftCodePoints = [...left];
  const rightCodePoints = [...right];
  let sharedLength = 0;

  while (
    sharedLength < leftCodePoints.length &&
    sharedLength < rightCodePoints.length &&
    leftCodePoints[leftCodePoints.length - 1 - sharedLength] ===
      rightCodePoints[rightCodePoints.length - 1 - sharedLength]
  ) {
    sharedLength += 1;
  }

  return leftCodePoints.slice(leftCodePoints.length - sharedLength).join("");
}

function getLongestPrefixAgainstSuffix(
  prefixSource: string,
  suffixSource: string
) {
  const prefixCodePoints = [...prefixSource];
  const suffixCodePoints = [...suffixSource];

  for (
    let sharedLength = Math.min(
      prefixCodePoints.length,
      suffixCodePoints.length
    );
    sharedLength >= 1;
    sharedLength -= 1
  ) {
    const prefix = prefixCodePoints.slice(0, sharedLength).join("");
    const suffix = suffixCodePoints
      .slice(suffixCodePoints.length - sharedLength)
      .join("");

    if (prefix === suffix) {
      return prefix;
    }
  }

  return "";
}

function trimTrailingKanaRun(value: string) {
  return normalizeKanjiClashSurface(value).replace(
    /[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u,
    ""
  );
}

function containsKana(value: string) {
  return /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(value);
}

function endsWithKana(value: string) {
  const lastCodePoint = [...value].at(-1);

  return lastCodePoint
    ? /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(lastCodePoint)
    : false;
}

function countCodePoints(value: string) {
  return [...value].length;
}

function normalizeKanaReading(value: string) {
  return normalizeKanjiClashSurface(value).replace(
    /[\u30a1-\u30f6]/g,
    (character) => String.fromCharCode(character.charCodeAt(0) - 0x60)
  );
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
