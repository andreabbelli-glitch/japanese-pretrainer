import { describe, expect, it, vi } from "vitest";

const { getKatakanaSpeedPageDataMock } = vi.hoisted(() => ({
  getKatakanaSpeedPageDataMock: vi.fn()
}));

vi.mock("@/components/katakana-speed/katakana-speed-page", () => ({
  KatakanaSpeedPage: (props: unknown) => ({
    props,
    type: "mock-katakana-speed-page"
  })
}));

vi.mock("@/features/katakana-speed/server", () => ({
  getKatakanaSpeedPageData: getKatakanaSpeedPageDataMock
}));

import KatakanaSpeedRoute from "@/app/katakana-speed/page";

describe("katakana speed route", () => {
  it("loads page data and renders the Katakana Speed page", async () => {
    getKatakanaSpeedPageDataMock.mockResolvedValue({
      recentSession: null,
      recommendedFocus: []
    });

    const element = await KatakanaSpeedRoute();

    expect(getKatakanaSpeedPageDataMock).toHaveBeenCalledTimes(1);
    expect(element.props).toMatchObject({
      data: {
        recentSession: null,
        recommendedFocus: []
      }
    });
  });
});
