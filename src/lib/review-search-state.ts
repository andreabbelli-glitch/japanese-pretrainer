type ReviewSearchState = {
  answeredCount: number;
  extraNewCount: number;
  noticeCode: string | null;
  segmentId: string | null;
  selectedCardId: string | null;
  showAnswer: boolean;
};

export type { ReviewSearchState };

export function buildReviewSearchStateCacheKeyParts(input: ReviewSearchState) {
  return [
    `answered:${input.answeredCount}`,
    `extra-new:${input.extraNewCount}`,
    `notice:${input.noticeCode ?? ""}`,
    `segment:${input.segmentId ?? ""}`,
    `selected:${input.selectedCardId ?? ""}`,
    `show:${input.showAnswer ? "1" : "0"}`
  ];
}

export function normalizeReviewSearchState(
  searchParams: Record<string, string | string[] | undefined>
): ReviewSearchState {
  const answeredCount = Number.parseInt(readSearchParam(searchParams, "answered"), 10);
  const extraNewCount = Number.parseInt(readSearchParam(searchParams, "extraNew"), 10);

  return {
    answeredCount: Number.isFinite(answeredCount) && answeredCount > 0 ? answeredCount : 0,
    extraNewCount: Number.isFinite(extraNewCount) && extraNewCount > 0 ? extraNewCount : 0,
    noticeCode: readSearchParam(searchParams, "notice") || null,
    segmentId: readSearchParam(searchParams, "segment") || null,
    selectedCardId: readSearchParam(searchParams, "card") || null,
    showAnswer: readSearchParam(searchParams, "show") === "answer"
  };
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}
