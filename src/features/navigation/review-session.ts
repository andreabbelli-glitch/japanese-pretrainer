import type { Route } from "next";

import {
  appendReturnToParam,
  buildHrefWithSearch,
  mediaReviewCardHref,
  mediaReviewHref,
  mediaStudyHref,
  reviewHref
} from "./hrefs.ts";

export type ReviewRedirectMode =
  | "advance_queue"
  | "preserve_card"
  | "stay_detail";

export function buildReviewSessionHref(input: {
  answeredCount?: number;
  cardId?: string | null;
  extraNewAnchorCount?: number | null;
  extraNewCount?: number;
  mediaSlug: string;
  mode?: "prestudy" | "review";
  segmentId?: string | null;
  showAnswer?: boolean;
}): Route {
  return buildReviewSessionHrefForBase(mediaReviewHref(input.mediaSlug), input);
}

export function buildGlobalReviewSessionHref(input: {
  answeredCount?: number;
  cardId?: string | null;
  extraNewAnchorCount?: number | null;
  extraNewCount?: number;
  mode?: "prestudy" | "review";
  segmentId?: string | null;
  showAnswer?: boolean;
}): Route {
  return buildReviewSessionHrefForBase(reviewHref(), input);
}

export function shouldPersistReviewSessionCard(input: {
  cardId?: string | null;
  isQueueCard: boolean;
  position: number | null;
}) {
  if (!input.cardId) {
    return false;
  }

  if (!input.isQueueCard) {
    return true;
  }

  return (input.position ?? 1) > 1;
}

export function buildCanonicalReviewSessionHref(input: {
  answeredCount?: number;
  cardId?: string | null;
  extraNewAnchorCount?: number | null;
  extraNewCount?: number;
  isQueueCard: boolean;
  mediaSlug: string;
  mode?: "prestudy" | "review";
  position: number | null;
  segmentId?: string | null;
  showAnswer?: boolean;
}): Route {
  return buildReviewSessionHref({
    answeredCount: input.answeredCount,
    cardId: shouldPersistReviewSessionCard(input) ? input.cardId : null,
    extraNewAnchorCount: input.extraNewAnchorCount,
    extraNewCount: input.extraNewCount,
    mediaSlug: input.mediaSlug,
    mode: input.mode,
    segmentId: input.segmentId,
    showAnswer: input.showAnswer
  });
}

export function buildCanonicalReviewSessionHrefForBase(input: {
  answeredCount?: number;
  baseHref: Route;
  cardId?: string | null;
  extraNewAnchorCount?: number | null;
  extraNewCount?: number;
  isQueueCard: boolean;
  mode?: "prestudy" | "review";
  position: number | null;
  segmentId?: string | null;
  showAnswer?: boolean;
}): Route {
  return buildReviewSessionHrefForBase(input.baseHref, {
    answeredCount: input.answeredCount,
    cardId: shouldPersistReviewSessionCard(input) ? input.cardId : null,
    extraNewAnchorCount: input.extraNewAnchorCount,
    extraNewCount: input.extraNewCount,
    mode: input.mode,
    segmentId: input.segmentId,
    showAnswer: input.showAnswer
  });
}

function buildReviewSessionHrefForBase(
  baseHref: Route,
  input: {
    answeredCount?: number;
    cardId?: string | null;
    extraNewAnchorCount?: number | null;
    extraNewCount?: number;
    mode?: "prestudy" | "review";
    segmentId?: string | null;
    showAnswer?: boolean;
  }
) {
  return buildHrefWithSearch(baseHref, (params) => {
    if (input.answeredCount && input.answeredCount > 0) {
      params.set("answered", String(input.answeredCount));
    }

    if (input.cardId) {
      params.set("card", input.cardId);
    }

    if (input.extraNewCount && input.extraNewCount > 0) {
      params.set("extraNew", String(input.extraNewCount));

      if (
        input.extraNewAnchorCount !== null &&
        input.extraNewAnchorCount !== undefined &&
        input.extraNewAnchorCount >= 0
      ) {
        params.set("extraNewAnchor", String(input.extraNewAnchorCount));
      }
    }

    if (input.mode === "prestudy") {
      params.set("mode", "prestudy");
    }

    if (input.segmentId) {
      params.set("segment", input.segmentId);
    }

    if (input.showAnswer) {
      params.set("show", "answer");
    }
  });
}

export function replaceReviewCardInHref(
  reviewHref: string,
  cardId: string
): Route {
  return buildHrefWithSearch(reviewHref, (params) => {
    params.set("card", cardId);
    params.delete("show");
  });
}

export function buildReviewRedirectUrl(input: {
  answeredCount: number;
  cardId?: string;
  extraNewAnchorCount?: number | null;
  extraNewCount?: number;
  mediaSlug: string;
  redirectMode?: ReviewRedirectMode;
  notice?: string;
  segmentId?: string | null;
  returnTo?: Route | null;
}): Route {
  if (input.redirectMode === "stay_detail" && input.cardId) {
    return appendReturnToParam(
      mediaReviewCardHref(input.mediaSlug, input.cardId),
      input.returnTo
    );
  }

  const params = new URLSearchParams(
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewAnchorCount: input.extraNewAnchorCount,
      extraNewCount: input.extraNewCount,
      notice: input.notice,
      redirectMode: input.redirectMode,
      segmentId: input.segmentId
    })
  );

  const baseHref = mediaStudyHref(input.mediaSlug, "review");

  return (
    params.size > 0 ? `${baseHref}?${params.toString()}` : baseHref
  ) as Route;
}

export function buildRedirectSearchParams(input: {
  answeredCount: number;
  cardId?: string;
  extraNewAnchorCount?: number | null;
  extraNewCount?: number;
  notice?: string;
  redirectMode?: ReviewRedirectMode;
  segmentId?: string | null;
}) {
  return buildReviewSearchParams({
    answeredCount: input.answeredCount,
    cardId:
      input.cardId && input.redirectMode === "preserve_card"
        ? input.cardId
        : undefined,
    extraNewAnchorCount: input.extraNewAnchorCount,
    extraNewCount: input.extraNewCount,
    notice: input.notice,
    segmentId: input.segmentId
  });
}

export function buildReviewSearchParams(input: {
  answeredCount: number;
  cardId?: string;
  extraNewAnchorCount?: number | null;
  extraNewCount?: number;
  notice?: string;
  segmentId?: string | null;
  showAnswer?: boolean;
}) {
  const params: Record<string, string> = {};

  if (input.answeredCount > 0) {
    params.answered = String(input.answeredCount);
  }

  if (input.cardId) {
    params.card = input.cardId;
  }

  if (input.extraNewCount && input.extraNewCount > 0) {
    params.extraNew = String(input.extraNewCount);

    if (
      input.extraNewAnchorCount !== null &&
      input.extraNewAnchorCount !== undefined &&
      input.extraNewAnchorCount >= 0
    ) {
      params.extraNewAnchor = String(input.extraNewAnchorCount);
    }
  }

  if (input.segmentId) {
    params.segment = input.segmentId;
  }

  if (input.notice) {
    params.notice = input.notice;
  }

  if (input.showAnswer) {
    params.show = "answer";
  }

  return params;
}
