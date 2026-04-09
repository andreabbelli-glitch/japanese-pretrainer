import type {
  KanjiClashCandidate,
  KanjiClashEligibleSubject
} from "./types.ts";
import {
  buildKanjiClashPairKey,
  getSharedKanji,
  hasQualifiedContainedCloneSurface,
  hasSharedComparisonSurface,
  hasSharedNormalizedSurface,
  hasSharedReading,
  orderKanjiClashSubjects
} from "./utils.ts";

export function buildKanjiClashInvertedIndex(subjects: KanjiClashEligibleSubject[]) {
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

export function getKanjiClashPairExclusionReason(
  left: KanjiClashEligibleSubject,
  right: KanjiClashEligibleSubject
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

  const sharedKanji = getSharedKanji(left, right);

  if (sharedKanji.length === 0) {
    return "no-shared-kanji";
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

  return null;
}

export function scoreKanjiClashCandidate(
  left: KanjiClashEligibleSubject,
  right: KanjiClashEligibleSubject
) {
  const sharedKanji = getSharedKanji(left, right);

  if (sharedKanji.length === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const leftLeadBonus = hasLeadKanjiMatch(left, sharedKanji) ? 14 : 0;
  const rightLeadBonus = hasLeadKanjiMatch(right, sharedKanji) ? 14 : 0;
  const surfaceDelta = Math.abs(left.label.length - right.label.length);
  const shapeBonus = Math.max(0, 12 - surfaceDelta * 3);
  const readingPenalty = hasSharedReading(left, right) ? 18 : 0;

  return sharedKanji.length * 100 + leftLeadBonus + rightLeadBonus + shapeBonus - readingPenalty;
}

export function buildKanjiClashCandidate(
  left: KanjiClashEligibleSubject,
  right: KanjiClashEligibleSubject
): KanjiClashCandidate | null {
  const exclusionReason = getKanjiClashPairExclusionReason(left, right);

  if (exclusionReason) {
    return null;
  }

  const [orderedLeft, orderedRight] = orderKanjiClashSubjects(left, right);

  return {
    left: orderedLeft,
    leftSubjectKey: orderedLeft.subjectKey,
    pairKey: buildKanjiClashPairKey(orderedLeft.subjectKey, orderedRight.subjectKey),
    right: orderedRight,
    rightSubjectKey: orderedRight.subjectKey,
    score: scoreKanjiClashCandidate(orderedLeft, orderedRight),
    sharedKanji: getSharedKanji(orderedLeft, orderedRight)
  };
}

export function generateKanjiClashCandidates(subjects: KanjiClashEligibleSubject[]) {
  const bestCandidatesByPairKey = new Map<string, KanjiClashCandidate>();

  for (const bucket of buildKanjiClashInvertedIndex(subjects).values()) {
    const orderedBucket = [...bucket].sort((left, right) =>
      left.subjectKey.localeCompare(right.subjectKey)
    );

    for (let leftIndex = 0; leftIndex < orderedBucket.length; leftIndex += 1) {
      const left = orderedBucket[leftIndex];

      if (!left) {
        continue;
      }

      for (
        let rightIndex = leftIndex + 1;
        rightIndex < orderedBucket.length;
        rightIndex += 1
      ) {
        const right = orderedBucket[rightIndex];

        if (!right) {
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
  }

  return [...bestCandidatesByPairKey.values()].sort((left, right) => {
    const scoreDifference = right.score - left.score;

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return left.pairKey.localeCompare(right.pairKey);
  });
}

function hasLeadKanjiMatch(
  subject: KanjiClashEligibleSubject,
  sharedKanji: string[]
) {
  const sharedSet = new Set(sharedKanji);

  return subject.surfaceForms.some((surface) => {
    const leadKanji = subject.kanji.find((kanji) => surface.includes(kanji));

    return leadKanji ? sharedSet.has(leadKanji) : false;
  });
}
