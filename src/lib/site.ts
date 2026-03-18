import type { Route } from "next";

export type NavItem = {
  href: "/" | "/media" | "/glossary" | "/review" | "/settings";
  label: string;
  description: string;
};

export type StudyAreaKey = "textbook" | "glossary" | "review" | "progress";
export type GlossaryEntryKind = "term" | "grammar";
export type GlossaryCardsFilter = "all" | "with_cards" | "without_cards";
export type GlossarySort = "lesson_order" | "alphabetical";
export type GlossaryStudyFilter =
  | "all"
  | "known"
  | "review"
  | "learning"
  | "new"
  | "available";
export type ReturnToContextKind =
  | "review"
  | "globalGlossary"
  | "localGlossary"
  | "mediaLibrary"
  | "media"
  | "other";

export type ReturnToContext = {
  href: Route;
  kind: ReturnToContextKind;
  pathname: string;
};

export type GlossaryHrefInput = {
  baseHref: Route;
  cards?: GlossaryCardsFilter;
  entryType?: "all" | GlossaryEntryKind;
  media?: string;
  query?: string;
  returnTo?: string | null;
  segmentId?: string;
  sort?: GlossarySort;
  study?: GlossaryStudyFilter;
};

export const primaryNav: NavItem[] = [
  {
    href: "/",
    label: "Home",
    description: "Continua a studiare"
  },
  {
    href: "/media",
    label: "Media",
    description: "I tuoi media"
  },
  {
    href: "/glossary",
    label: "Glossary",
    description: "Consulta le voci"
  },
  {
    href: "/review",
    label: "Review",
    description: "Ripasso di oggi"
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Preferenze"
  }
];

export function resolveActivePrimaryNavHref(pathname: string): NavItem["href"] {
  if (pathname === "/" || pathname.length === 0) {
    return "/";
  }

  if (
    pathname === "/review" ||
    pathname.startsWith("/review/") ||
    /^\/media\/[^/]+\/review(?:\/|$)/.test(pathname)
  ) {
    return "/review";
  }

  if (
    pathname === "/glossary" ||
    pathname.startsWith("/glossary/") ||
    /^\/media\/[^/]+\/glossary(?:\/|$)/.test(pathname)
  ) {
    return "/glossary";
  }

  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return "/settings";
  }

  if (pathname === "/media" || pathname.startsWith("/media/")) {
    return "/media";
  }

  return "/";
}

export function mediaHref(mediaSlug: string): Route {
  return `/media/${mediaSlug}` as Route;
}

export function mediaGlossaryHref(mediaSlug: string): Route {
  return buildGlossaryHref({
    baseHref: "/glossary" as Route,
    media: mediaSlug
  });
}

export function mediaStudyHref(mediaSlug: string, area: StudyAreaKey): Route {
  return `/media/${mediaSlug}/${area}` as Route;
}

export function mediaReviewCardHref(mediaSlug: string, cardId: string): Route {
  return `/media/${mediaSlug}/review/card/${cardId}` as Route;
}

export function mediaTextbookLessonHref(
  mediaSlug: string,
  lessonSlug: string
): Route {
  return `/media/${mediaSlug}/textbook/${lessonSlug}` as Route;
}

export function mediaTextbookLessonTooltipsHref(
  mediaSlug: string,
  lessonSlug: string
): Route {
  return `/media/${mediaSlug}/textbook/${lessonSlug}/tooltips` as Route;
}

export function mediaAssetHref(mediaSlug: string, assetPath: string): Route {
  const normalizedAssetPath = assetPath.startsWith("assets/")
    ? assetPath.slice("assets/".length)
    : assetPath;
  const normalizedPath = normalizedAssetPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/media/${mediaSlug}/assets/${normalizedPath}` as Route;
}

export function mediaGlossaryTermHref(
  mediaSlug: string,
  entryId: string
): Route {
  return `/media/${mediaSlug}/glossary/term/${entryId}` as Route;
}

export function mediaGlossaryGrammarHref(
  mediaSlug: string,
  entryId: string
): Route {
  return `/media/${mediaSlug}/glossary/grammar/${entryId}` as Route;
}

export function mediaGlossaryEntryHref(
  mediaSlug: string,
  entryKind: GlossaryEntryKind,
  entryId: string
): Route {
  return entryKind === "term"
    ? mediaGlossaryTermHref(mediaSlug, entryId)
    : mediaGlossaryGrammarHref(mediaSlug, entryId);
}

export function buildHrefWithSearch(
  href: string,
  update: (params: URLSearchParams) => void
): Route {
  const url = new URL(href, "https://jcs.local");
  const params = new URLSearchParams(url.search);

  update(params);

  const query = params.toString();

  return `${url.pathname}${query ? `?${query}` : ""}` as Route;
}

export function buildReviewSessionHref(input: {
  answeredCount?: number;
  cardId?: string | null;
  extraNewCount?: number;
  mediaSlug: string;
  showAnswer?: boolean;
}): Route {
  return buildHrefWithSearch(
    mediaStudyHref(input.mediaSlug, "review"),
    (params) => {
      if (input.answeredCount && input.answeredCount > 0) {
        params.set("answered", String(input.answeredCount));
      }

      if (input.cardId) {
        params.set("card", input.cardId);
      }

      if (input.extraNewCount && input.extraNewCount > 0) {
        params.set("extraNew", String(input.extraNewCount));
      }

      if (input.showAnswer) {
        params.set("show", "answer");
      }
    }
  );
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
  showAnswer?: boolean;
}): Route {
  return buildReviewSessionHref({
    answeredCount: input.answeredCount,
    cardId: shouldPersistReviewSessionCard(input) ? input.cardId : null,
    extraNewCount: input.extraNewCount,
    mediaSlug: input.mediaSlug,
    showAnswer: input.showAnswer
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

export function appendReturnToParam(
  href: string,
  returnTo?: string | null
): Route {
  if (!returnTo) {
    return href as Route;
  }

  return buildHrefWithSearch(href, (params) => {
    params.set("returnTo", returnTo);
  });
}

export function buildGlossaryHref(input: GlossaryHrefInput): Route {
  return buildHrefWithSearch(input.baseHref, (params) => {
    setOptionalSearchParam(params, "q", input.query);
    setOptionalSearchParam(params, "type", input.entryType, "all");
    setOptionalSearchParam(params, "media", input.media, "all");
    setOptionalSearchParam(params, "segment", input.segmentId, "all");
    setOptionalSearchParam(params, "study", input.study, "all");
    setOptionalSearchParam(params, "cards", input.cards, "all");
    setOptionalSearchParam(params, "sort", input.sort, "lesson_order");
    setOptionalSearchParam(params, "returnTo", input.returnTo);
  });
}

export function readInternalHref(
  value: string | string[] | undefined
): Route | null {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  return trimmed as Route;
}

export function readNestedReturnTo(
  value: string | string[] | Route | null | undefined
): Route | null {
  const href = readInternalHref(
    Array.isArray(value) ? value : value === null ? undefined : value
  );

  if (!href) {
    return null;
  }

  const nestedReturnTo = new URL(href, "https://jcs.local").searchParams.get(
    "returnTo"
  );

  return readInternalHref(nestedReturnTo ?? undefined);
}

export function resolveReturnToContext(
  value: string | string[] | Route | null | undefined
): ReturnToContext | null {
  const href = readInternalHref(
    Array.isArray(value) ? value : value === null ? undefined : value
  );

  if (!href) {
    return null;
  }

  const pathname = new URL(href, "https://jcs.local").pathname;

  if (
    pathname === "/review" ||
    pathname.startsWith("/review/") ||
    /^\/media\/[^/]+\/review(?:\/|$)/.test(pathname)
  ) {
    return {
      href,
      kind: "review",
      pathname
    };
  }

  if (pathname === "/glossary" || pathname.startsWith("/glossary/")) {
    return {
      href,
      kind: "globalGlossary",
      pathname
    };
  }

  if (/^\/media\/[^/]+\/glossary(?:\/|$)/.test(pathname)) {
    return {
      href,
      kind: "localGlossary",
      pathname
    };
  }

  if (pathname === "/media") {
    return {
      href,
      kind: "mediaLibrary",
      pathname
    };
  }

  if (/^\/media\/[^/]+(?:\/|$)/.test(pathname)) {
    return {
      href,
      kind: "media",
      pathname
    };
  }

  return {
    href,
    kind: "other",
    pathname
  };
}

export function resolveReturnToLabel(
  context: ReturnToContext | null
): string | null {
  if (!context) {
    return null;
  }

  switch (context.kind) {
    case "review":
      return "Torna alla Review";
    case "globalGlossary":
    case "localGlossary":
      return "Torna al Glossary";
    case "mediaLibrary":
      return "Torna ai Media";
    case "media":
      return "Torna al Media";
    case "other":
      return null;
  }
}

export function resolveGlossaryReviewReturnTo(
  value: string | string[] | Route | null | undefined
): Route | null {
  let currentHref = readInternalHref(
    Array.isArray(value) ? value : value === null ? undefined : value
  );

  while (currentHref) {
    const currentContext = resolveReturnToContext(currentHref);

    if (currentContext?.kind === "review") {
      return currentContext.href;
    }

    if (
      currentContext?.kind !== "globalGlossary" &&
      currentContext?.kind !== "localGlossary"
    ) {
      return null;
    }

    currentHref = readNestedReturnTo(currentContext.href);
  }

  return null;
}

export function resolveGlossaryBackNavigation(input: {
  localGlossaryHref: Route;
  mediaHref: Route;
  mediaTitle: string;
  page: "index" | "detail";
  returnTo?: Route | null;
}) {
  const returnContext = resolveReturnToContext(input.returnTo);

  switch (returnContext?.kind) {
    case "review":
      return {
        backHref: returnContext.href,
        backLabel: "Torna alla Review",
        returnContext
      };
    case "globalGlossary":
    case "localGlossary":
      return {
        backHref: returnContext.href,
        backLabel: "Torna al Glossary",
        returnContext
      };
    case "mediaLibrary":
      return {
        backHref: returnContext.href,
        backLabel: "Torna ai Media",
        returnContext
      };
    case "media":
      return {
        backHref: returnContext.href,
        backLabel: `Torna a ${input.mediaTitle}`,
        returnContext
      };
    case "other":
    case undefined:
      return {
        backHref:
          input.page === "detail" ? input.localGlossaryHref : input.mediaHref,
        backLabel:
          input.page === "detail"
            ? "Torna al Glossary"
            : `Torna a ${input.mediaTitle}`,
        returnContext: returnContext ?? null
      };
  }
}

function setOptionalSearchParam(
  params: URLSearchParams,
  key: string,
  value?: string | null,
  defaultValue?: string
) {
  if (!value || value === defaultValue) {
    params.delete(key);
    return;
  }

  params.set(key, value);
}
