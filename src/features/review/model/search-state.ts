import {
  readFirstNonEmptySearchParam,
  readMatchingSearchParam,
  readPositiveIntegerSearchParam
} from "@/features/shared/model/search-params";

type ReviewSearchState = {
  answeredCount: number;
  extraNewAnchorCount: number | null;
  extraNewCount: number;
  mode: "review" | "prestudy";
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
    `extra-new-anchor:${input.extraNewAnchorCount ?? ""}`,
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
  const extraNewAnchorCount =
    extraNewCount > 0
      ? (readNonNegativeIntegerSearchParam(searchParams.extraNewAnchor) ?? null)
      : null;

  return {
    answeredCount,
    extraNewAnchorCount,
    extraNewCount,
    mode:
      readMatchingSearchParam(
        searchParams.mode,
        (value): value is "prestudy" => value === "prestudy"
      ) ?? "review",
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

function readNonNegativeIntegerSearchParam(
  value: string | string[] | undefined
) {
  const matched = readMatchingSearchParam(value, (candidate) => {
    if (!/^\d+$/u.test(candidate)) {
      return false;
    }

    const parsed = Number.parseInt(candidate, 10);

    return Number.isSafeInteger(parsed) && parsed >= 0;
  });

  return matched ? Number.parseInt(matched, 10) : undefined;
}
