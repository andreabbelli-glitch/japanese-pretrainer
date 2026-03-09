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

export function mediaHref(mediaSlug: string): Route {
  return `/media/${mediaSlug}` as Route;
}

export function mediaStudyHref(
  mediaSlug: string,
  area: StudyAreaKey
): Route {
  return `/media/${mediaSlug}/${area}` as Route;
}

export function mediaReviewCardHref(
  mediaSlug: string,
  cardId: string
): Route {
  return `/media/${mediaSlug}/review/card/${cardId}` as Route;
}

export function mediaTextbookLessonHref(
  mediaSlug: string,
  lessonSlug: string
): Route {
  return `/media/${mediaSlug}/textbook/${lessonSlug}` as Route;
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
