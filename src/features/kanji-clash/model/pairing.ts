import type {
  KanjiClashCandidate,
  KanjiClashEligibleSubject,
  KanjiClashPairReason,
  KanjiClashSimilarKanjiSwap
} from "../types.ts";
import {
  buildKanjiClashSimilarKanjiSwap,
  listKanjiClashSimilarKanjiTargets
} from "./similar-kanji.ts";
import {
  hasContextualizedHeadFamilySurface,
  hasCrossEdgeMixedStemSurface,
  hasSharedContextualPrefixSurface,
  getSharedKanji,
  hasQualifiedContainedCloneSurface,
  hasSameKanjiCoreReadingSurface,
  hasSharedLexicalCoreSurface,
  hasSharedComparisonSurface,
  hasSharedNormalizedSurface,
  hasSharedReading,
  isKanjiClashKanjiCharacter,
  orderKanjiClashSubjects,
  splitKanjiClashSurfaceIntoCodePoints
} from "./utils.ts";

export function buildKanjiClashInvertedIndex(
  subjects: KanjiClashEligibleSubject[]
) {
  const index = new Map<string, KanjiClashEligibleSubject[]>();

  for (const subject of subjects) {
    for (const kanji of subject.kanji) {
      const bucket = index.get(kanji);

      if (bucket) {
        bucket.push(subject);
        continue;
      }

      index.set(kanji, [subject]);
    }
  }

  return index;
}

export function collectKanjiClashRelatedSubjects(
  subject: KanjiClashEligibleSubject,
  index: Map<string, KanjiClashEligibleSubject[]>
) {
  const relatedSubjects = new Map<string, KanjiClashEligibleSubject>();

  for (const kanji of subject.kanji) {
    for (const relatedSubject of index.get(kanji) ?? []) {
      relatedSubjects.set(relatedSubject.subjectKey, relatedSubject);
    }

    for (const similarKanji of listKanjiClashSimilarKanjiTargets(kanji)) {
      for (const relatedSubject of index.get(similarKanji) ?? []) {
        relatedSubjects.set(relatedSubject.subjectKey, relatedSubject);
      }
    }
  }

  relatedSubjects.delete(subject.subjectKey);

  return [...relatedSubjects.values()];
}

export function getKanjiClashPairExclusionReason(
  left: KanjiClashEligibleSubject,
  right: KanjiClashEligibleSubject
) {
  return getKanjiClashPairExclusionReasonFromSharedKanji(
    left,
    right,
    getSharedKanji(left, right),
    findSimilarKanjiSwaps(left, right)
  );
}

function getKanjiClashPairExclusionReasonFromSharedKanji(
  left: KanjiClashEligibleSubject,
  right: KanjiClashEligibleSubject,
  sharedKanji: string[],
  similarKanjiSwaps: KanjiClashSimilarKanjiSwap[]
) {
  if (left.subjectKey === right.subjectKey) {
    return "same-subject";
  }

  if (left.source.type === "entry" && right.source.type === "entry") {
    if (left.source.entryId === right.source.entryId) {
      return "same-entry";
    }
  }

  if (left.source.type === "group" && right.source.type === "group") {
    if (left.source.crossMediaGroupId === right.source.crossMediaGroupId) {
      return "same-group";
    }
  }

  if (sharedKanji.length === 0 && similarKanjiSwaps.length === 0) {
    return "no-pairing-signal";
  }

  if (hasSharedNormalizedSurface(left, right)) {
    return "same-surface";
  }

  if (hasSharedComparisonSurface(left, right)) {
    return "editorial-clone";
  }

  if (hasQualifiedContainedCloneSurface(left, right)) {
    return "qualified-contained-clone";
  }

  if (hasSharedLexicalCoreSurface(left, right)) {
    return "shared-lexical-core";
  }

  if (hasSharedContextualPrefixSurface(left, right)) {
    return "shared-contextual-prefix";
  }

  if (hasContextualizedHeadFamilySurface(left, right)) {
    return "contextualized-head-family";
  }

  if (hasCrossEdgeMixedStemSurface(left, right)) {
    return "cross-edge-mixed-stem";
  }

  if (hasSameKanjiCoreReadingSurface(left, right)) {
    return "same-kanji-core-reading";
  }

  return null;
}

export function scoreKanjiClashCandidate(
  left: KanjiClashEligibleSubject,
  right: KanjiClashEligibleSubject,
  sharedKanji = getSharedKanji(left, right),
  similarKanjiSwaps = findSimilarKanjiSwaps(left, right)
) {
  if (sharedKanji.length === 0 && similarKanjiSwaps.length === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const readingPenalty = hasSharedReading(left, right) ? 18 : 0;
  const sharedScore =
    sharedKanji.length > 0
      ? scoreSharedKanjiCandidate(left, right, sharedKanji, readingPenalty)
      : Number.NEGATIVE_INFINITY;
  const similarScore =
    similarKanjiSwaps.length > 0
      ? scoreSimilarKanjiCandidate(similarKanjiSwaps, readingPenalty)
      : Number.NEGATIVE_INFINITY;

  return Math.max(sharedScore, similarScore);
}

export function buildKanjiClashCandidate(
  left: KanjiClashEligibleSubject,
  right: KanjiClashEligibleSubject
): KanjiClashCandidate | null {
  const [orderedLeft, orderedRight] = orderKanjiClashSubjects(left, right);
  const sharedKanji = getSharedKanji(orderedLeft, orderedRight);
  const similarKanjiSwaps = findSimilarKanjiSwaps(orderedLeft, orderedRight);
  const exclusionReason = getKanjiClashPairExclusionReasonFromSharedKanji(
    orderedLeft,
    orderedRight,
    sharedKanji,
    similarKanjiSwaps
  );

  if (exclusionReason) {
    return null;
  }

  const pairReasons = buildPairReasons(sharedKanji, similarKanjiSwaps);

  return {
    left: orderedLeft,
    leftSubjectKey: orderedLeft.subjectKey,
    pairKey: buildKanjiClashOrderedPairKey(
      orderedLeft.subjectKey,
      orderedRight.subjectKey
    ),
    pairReasons,
    right: orderedRight,
    rightSubjectKey: orderedRight.subjectKey,
    score: scoreKanjiClashCandidate(
      orderedLeft,
      orderedRight,
      sharedKanji,
      similarKanjiSwaps
    ),
    sharedKanji,
    similarKanjiSwaps
  };
}

export function generateKanjiClashCandidates(
  subjects: KanjiClashEligibleSubject[]
) {
  const bestCandidatesByPairKey = new Map<string, KanjiClashCandidate>();
  const orderedSubjects = [...subjects].sort((left, right) =>
    left.subjectKey.localeCompare(right.subjectKey)
  );
  const index = buildKanjiClashInvertedIndex(subjects);

  for (const left of orderedSubjects) {
    for (const right of collectKanjiClashRelatedSubjects(left, index)) {
      if (right.subjectKey.localeCompare(left.subjectKey) <= 0) {
        continue;
      }

      const candidate = buildKanjiClashCandidate(left, right);

      if (!candidate) {
        continue;
      }

      const existing = bestCandidatesByPairKey.get(candidate.pairKey);

      if (
        !existing ||
        candidate.score > existing.score ||
        (candidate.score === existing.score &&
          candidate.pairKey.localeCompare(existing.pairKey) < 0)
      ) {
        bestCandidatesByPairKey.set(candidate.pairKey, candidate);
      }
    }
  }

  return [...bestCandidatesByPairKey.values()].sort((left, right) => {
    const scoreDifference = right.score - left.score;

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return left.pairKey.localeCompare(right.pairKey);
  });
}

function buildPairReasons(
  sharedKanji: string[],
  similarKanjiSwaps: KanjiClashSimilarKanjiSwap[]
) {
  const pairReasons: KanjiClashPairReason[] = [];

  if (sharedKanji.length > 0) {
    pairReasons.push("shared-kanji");
  }

  if (similarKanjiSwaps.length > 0) {
    pairReasons.push("similar-kanji");
  }

  return pairReasons;
}

function findSimilarKanjiSwaps(
  left: KanjiClashEligibleSubject,
  right: KanjiClashEligibleSubject
) {
  const swapsByKey = new Map<string, KanjiClashSimilarKanjiSwap>();

  for (const leftSurface of left.surfaceForms) {
    for (const rightSurface of right.surfaceForms) {
      const swap = findSinglePositionSimilarKanjiSwap(
        leftSurface,
        rightSurface
      );

      if (!swap) {
        continue;
      }

      const key = `${swap.position}:${swap.leftKanji}:${swap.rightKanji}`;
      const existing = swapsByKey.get(key);

      if (!existing || swap.confidence > existing.confidence) {
        swapsByKey.set(key, swap);
      }
    }
  }

  return [...swapsByKey.values()].sort((leftSwap, rightSwap) => {
    const positionDifference = leftSwap.position - rightSwap.position;

    if (positionDifference !== 0) {
      return positionDifference;
    }

    return `${leftSwap.leftKanji}:${leftSwap.rightKanji}`.localeCompare(
      `${rightSwap.leftKanji}:${rightSwap.rightKanji}`
    );
  });
}

function findSinglePositionSimilarKanjiSwap(
  leftSurface: string,
  rightSurface: string
) {
  const leftCodePoints = splitKanjiClashSurfaceIntoCodePoints(leftSurface);
  const rightCodePoints = splitKanjiClashSurfaceIntoCodePoints(rightSurface);

  if (leftCodePoints.length !== rightCodePoints.length) {
    return null;
  }

  let differingPosition = -1;

  for (let index = 0; index < leftCodePoints.length; index += 1) {
    const leftCodePoint = leftCodePoints[index];
    const rightCodePoint = rightCodePoints[index];

    if (!leftCodePoint || !rightCodePoint || leftCodePoint === rightCodePoint) {
      continue;
    }

    if (differingPosition !== -1) {
      return null;
    }

    differingPosition = index;
  }

  if (differingPosition === -1) {
    return null;
  }

  const leftKanji = leftCodePoints[differingPosition];
  const rightKanji = rightCodePoints[differingPosition];

  if (
    !leftKanji ||
    !rightKanji ||
    !isKanjiClashKanjiCharacter(leftKanji) ||
    !isKanjiClashKanjiCharacter(rightKanji)
  ) {
    return null;
  }

  return buildKanjiClashSimilarKanjiSwap(
    leftKanji,
    rightKanji,
    differingPosition
  );
}

function scoreSharedKanjiCandidate(
  left: KanjiClashEligibleSubject,
  right: KanjiClashEligibleSubject,
  sharedKanji: string[],
  readingPenalty: number
) {
  const sharedKanjiSet = new Set(sharedKanji);
  const leftLeadBonus = hasLeadKanjiMatch(left, sharedKanjiSet) ? 14 : 0;
  const rightLeadBonus = hasLeadKanjiMatch(right, sharedKanjiSet) ? 14 : 0;
  const surfaceDelta = Math.abs(left.label.length - right.label.length);
  const shapeBonus = Math.max(0, 12 - surfaceDelta * 3);

  return (
    sharedKanji.length * 100 +
    leftLeadBonus +
    rightLeadBonus +
    shapeBonus -
    readingPenalty
  );
}

function scoreSimilarKanjiCandidate(
  similarKanjiSwaps: KanjiClashSimilarKanjiSwap[],
  readingPenalty: number
) {
  const bestSwap = similarKanjiSwaps.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );
  const positionBonus = Math.max(0, 10 - bestSwap.position * 2);

  return (
    86 + Math.round(bestSwap.confidence * 32) + positionBonus - readingPenalty
  );
}

function hasLeadKanjiMatch(
  subject: KanjiClashEligibleSubject,
  sharedKanji: ReadonlySet<string>
) {
  return subject.surfaceForms.some((surface) => {
    const leadKanji = subject.kanji.find((kanji) => surface.includes(kanji));

    return leadKanji ? sharedKanji.has(leadKanji) : false;
  });
}

function buildKanjiClashOrderedPairKey(
  leftSubjectKey: string,
  rightSubjectKey: string
) {
  return `${leftSubjectKey}::${rightSubjectKey}`;
}
