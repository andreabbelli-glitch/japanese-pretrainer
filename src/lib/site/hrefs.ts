import type { Route } from "next";

export type AppHref = Route;
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
export type KanjiClashMode = "automatic" | "manual";

export type GlossaryHrefInput = {
  baseHref: Route;
  cards?: GlossaryCardsFilter;
  entryType?: "all" | GlossaryEntryKind;
  media?: string;
  page?: number;
  query?: string;
  returnTo?: string | null;
  segmentId?: string;
  sort?: GlossarySort;
  study?: GlossaryStudyFilter;
};

export type GlossaryEntryHrefOptions = {
  media?: string;
  sourceId?: string;
};

export type KanjiClashHrefInput = {
  media?: string;
  mode?: KanjiClashMode;
  size?: number;
};

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
  if (area === "glossary") {
    return mediaGlossaryHref(mediaSlug);
  }

  return `/media/${mediaSlug}/${area}` as Route;
}

export function reviewHref(): Route {
  return "/review" as Route;
}

export function kanjiClashHref(input: KanjiClashHrefInput = {}): Route {
  return buildHrefWithSearch("/kanji-clash", (params) => {
    setOptionalSearchParam(params, "mode", input.mode);
    setOptionalSearchParam(params, "media", input.media);
    setOptionalSearchParam(
      params,
      "size",
      typeof input.size === "number" &&
        Number.isFinite(input.size) &&
        input.size > 0
        ? String(Math.round(input.size))
        : undefined
    );
  });
}

export function mediaKanjiClashHref(
  mediaSlug: string,
  input: Omit<KanjiClashHrefInput, "media"> = {}
): Route {
  return kanjiClashHref({
    ...input,
    media: mediaSlug
  });
}

export function mediaReviewHref(mediaSlug: string): Route {
  return mediaStudyHref(mediaSlug, "review");
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
  const normalizedAssetPath = normalizeAssetPath(assetPath);
  const relativeAssetPath = normalizedAssetPath.startsWith("assets/")
    ? normalizedAssetPath.slice("assets/".length)
    : normalizedAssetPath;
  const normalizedPath = relativeAssetPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/media/${mediaSlug}/assets/${normalizedPath}` as Route;
}

export function mediaGlossaryTermHref(
  entrySurface: string,
  options: GlossaryEntryHrefOptions = {}
): Route {
  return globalGlossaryEntryHref("term", entrySurface, options);
}

export function mediaGlossaryGrammarHref(
  entrySurface: string,
  options: GlossaryEntryHrefOptions = {}
): Route {
  return globalGlossaryEntryHref("grammar", entrySurface, options);
}

export function mediaGlossaryEntryHref(
  mediaSlug: string,
  entryKind: GlossaryEntryKind,
  entrySurface: string,
  options: Omit<GlossaryEntryHrefOptions, "media"> = {}
): Route {
  return entryKind === "term"
    ? mediaGlossaryTermHref(entrySurface, {
        media: mediaSlug,
        ...options
      })
    : mediaGlossaryGrammarHref(entrySurface, {
        media: mediaSlug,
        ...options
      });
}

function globalGlossaryEntryHref(
  entryKind: GlossaryEntryKind,
  entrySurface: string,
  options: GlossaryEntryHrefOptions
): Route {
  const encodedSurface = encodeURIComponent(normalizeGlossaryEntrySurface(entrySurface));

  return buildHrefWithSearch(`/glossary/${entryKind}/${encodedSurface}`, (params) => {
    setOptionalSearchParam(params, "media", options.media, "all");
    setOptionalSearchParam(params, "source", options.sourceId);
  });
}

function normalizeGlossaryEntrySurface(value: string) {
  return value.replace(/[～〜]/g, "〜").replace(/\s+/g, " ").trim();
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
    setOptionalSearchParam(params, "media", input.media ?? params.get("media"), "all");
    setOptionalSearchParam(
      params,
      "page",
      input.page && input.page > 1 ? String(input.page) : undefined,
      "1"
    );
    setOptionalSearchParam(params, "segment", input.segmentId, "all");
    setOptionalSearchParam(params, "study", input.study, "all");
    setOptionalSearchParam(params, "cards", input.cards, "all");
    setOptionalSearchParam(params, "sort", input.sort, "lesson_order");
    setOptionalSearchParam(params, "returnTo", input.returnTo);
  });
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

function normalizeAssetPath(assetPath: string) {
  const normalizedSegments = assetPath
    .replaceAll("\\", "/")
    .trim()
    .replace(/^\/+/u, "")
    .split("/")
    .filter(Boolean)
    .reduce<string[]>((segments, segment) => {
      if (segment === ".") {
        return segments;
      }

      if (segment === "..") {
        segments.pop();
        return segments;
      }

      segments.push(segment);
      return segments;
    }, []);

  return normalizedSegments.join("/");
}
