import {
  readFirstNonEmptySearchParam,
  readMatchingSearchParam,
  readPositiveIntegerSearchParam
} from "@/lib/search-params";

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
  const answeredCount =
    readPositiveIntegerSearchParam(searchParams.answered) ?? 0;
  const extraNewCount =
    readPositiveIntegerSearchParam(searchParams.extraNew) ?? 0;

  return {
    answeredCount,
    extraNewCount,
    noticeCode: readSearchParam(searchParams, "notice") || null,
    segmentId: readSearchParam(searchParams, "segment") || null,
    selectedCardId: readSearchParam(searchParams, "card") || null,
    showAnswer:
      readMatchingSearchParam(
        searchParams.show,
        (value): value is "answer" => value === "answer"
      ) === "answer"
  };
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  return readFirstNonEmptySearchParam(searchParams[key]) ?? "";
}
