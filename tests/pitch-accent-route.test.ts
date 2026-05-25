import { describe, expect, it, vi } from "vitest";

const { getPitchAccentPageDataMock } = vi.hoisted(() => ({
  getPitchAccentPageDataMock: vi.fn()
}));

vi.mock("@/components/pitch-accent/pitch-accent-page", () => ({
  PitchAccentPage: (props: unknown) => ({
    props,
    type: "mock-pitch-accent-page"
  })
}));

vi.mock("@/features/pitch-accent/server", () => ({
  getPitchAccentPageData: getPitchAccentPageDataMock
}));

import PitchAccentRoute from "@/app/pitch-accent/page";

describe("pitch accent route", () => {
  it("loads page data and renders the pitch accent page", async () => {
    getPitchAccentPageDataMock.mockResolvedValue({
      corpusPairCount: 1882,
      recentSession: null
    });

    const element = await PitchAccentRoute();

    expect(getPitchAccentPageDataMock).toHaveBeenCalledTimes(1);
    expect(element.props).toMatchObject({
      data: {
        corpusPairCount: 1882,
        recentSession: null
      }
    });
  });
});
