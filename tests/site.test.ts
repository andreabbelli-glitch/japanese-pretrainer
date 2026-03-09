import { describe, expect, it } from "vitest";

import {
  mediaHref,
  mediaStudyHref,
  primaryNav,
  type StudyAreaKey
} from "@/lib/site";

describe("site helpers", () => {
  it("keeps primary navigation labels unique and routable", () => {
    const labels = primaryNav.map((item) => item.label);
    const hrefs = primaryNav.map((item) => item.href);

    expect(new Set(labels).size).toBe(labels.length);
    expect(hrefs.every((href) => href.startsWith("/"))).toBe(true);
  });

  it("builds stable routes for media detail and study areas", () => {
    const areas: StudyAreaKey[] = [
      "textbook",
      "glossary",
      "review",
      "progress"
    ];

    expect(mediaHref("demo-anime")).toBe("/media/demo-anime");
    expect(areas.map((area) => mediaStudyHref("demo-anime", area))).toEqual([
      "/media/demo-anime/textbook",
      "/media/demo-anime/glossary",
      "/media/demo-anime/review",
      "/media/demo-anime/progress"
    ]);
  });
});
