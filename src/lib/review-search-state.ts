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
  const answeredCount = readPositiveIntegerSearchParam(searchParams, "answered");
  const extraNewCount = readPositiveIntegerSearchParam(searchParams, "extraNew");

  return {
    answeredCount,
    extraNewCount,
    noticeCode: readSearchParam(searchParams, "notice") || null,
    segmentId: readSearchParam(searchParams, "segment") || null,
    selectedCardId: readSearchParam(searchParams, "card") || null,
    showAnswer: readSearchParam(searchParams, "show") === "answer"
  };
}

function readPositiveIntegerSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = readSearchParam(searchParams, key);

  if (!/^\d+$/u.test(value)) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
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
