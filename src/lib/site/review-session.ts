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
  extraNewCount?: number;
  mediaSlug: string;
  segmentId?: string | null;
  showAnswer?: boolean;
}): Route {
  return buildReviewSessionHrefForBase(mediaReviewHref(input.mediaSlug), input);
}

export function buildGlobalReviewSessionHref(input: {
  answeredCount?: number;
  cardId?: string | null;
  extraNewCount?: number;
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
  extraNewCount?: number;
  isQueueCard: boolean;
  mediaSlug: string;
  position: number | null;
  segmentId?: string | null;
  showAnswer?: boolean;
}): Route {
  return buildReviewSessionHref({
    answeredCount: input.answeredCount,
    cardId: shouldPersistReviewSessionCard(input) ? input.cardId : null,
    extraNewCount: input.extraNewCount,
    mediaSlug: input.mediaSlug,
    segmentId: input.segmentId,
    showAnswer: input.showAnswer
  });
}

export function buildCanonicalReviewSessionHrefForBase(input: {
  answeredCount?: number;
  baseHref: Route;
  cardId?: string | null;
  extraNewCount?: number;
  isQueueCard: boolean;
  position: number | null;
  segmentId?: string | null;
  showAnswer?: boolean;
}): Route {
  return buildReviewSessionHrefForBase(input.baseHref, {
    answeredCount: input.answeredCount,
    cardId: shouldPersistReviewSessionCard(input) ? input.cardId : null,
    extraNewCount: input.extraNewCount,
    segmentId: input.segmentId,
    showAnswer: input.showAnswer
  });
}

function buildReviewSessionHrefForBase(
  baseHref: Route,
  input: {
    answeredCount?: number;
    cardId?: string | null;
    extraNewCount?: number;
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
    extraNewCount: input.extraNewCount,
    notice: input.notice,
    segmentId: input.segmentId
  });
}

export function buildReviewSearchParams(input: {
  answeredCount: number;
  cardId?: string;
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
