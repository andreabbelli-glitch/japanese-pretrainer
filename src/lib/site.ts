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

export function mediaTextbookLessonHref(
  mediaSlug: string,
  lessonSlug: string
): Route {
  return `/media/${mediaSlug}/textbook/${lessonSlug}` as Route;
}
