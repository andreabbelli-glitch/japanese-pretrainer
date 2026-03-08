import { describe, expect, it } from "vitest";

import { primaryNav, progressTracks, routePlaceholders } from "@/lib/site";

describe("foundation site data", () => {
  it("keeps primary navigation labels unique and routable", () => {
    const labels = primaryNav.map((item) => item.label);
    const hrefs = primaryNav.map((item) => item.href);

    expect(new Set(labels).size).toBe(labels.length);
    expect(hrefs.every((href) => href.startsWith("/"))).toBe(true);
  });

  it("exposes calm progress tracks and placeholder routes", () => {
    expect(progressTracks).toHaveLength(3);
    expect(routePlaceholders.media.sections.length).toBeGreaterThan(0);
    expect(routePlaceholders.review.sections.length).toBeGreaterThan(0);
    expect(routePlaceholders.settings.sections.length).toBeGreaterThan(0);
  });
});
