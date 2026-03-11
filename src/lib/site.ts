import type { Route } from "next";

export type NavItem = {
  href: "/" | "/media" | "/review" | "/settings";
  label: string;
  description: string;
};

export type PlaceholderSection = {
  title: string;
  body: string;
};

export type StudyAreaKey = "textbook" | "glossary" | "review" | "progress";
export type GlossaryEntryKind = "term" | "grammar";

export const primaryNav: NavItem[] = [
  {
    href: "/",
    label: "Home",
    description: "Ripresa studio"
  },
  {
    href: "/media",
    label: "Media",
    description: "Libreria attiva"
  },
  {
    href: "/review",
    label: "Review",
    description: "Sessioni quotidiane"
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Preferenze locali"
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
