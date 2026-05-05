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

export function orderKanjiClashSubjects<T extends { subjectKey: string }>(
  left: T,
  right: T
): [T, T] {
  return left.subjectKey.localeCompare(right.subjectKey) <= 0
    ? [left, right]
    : [right, left];
}
