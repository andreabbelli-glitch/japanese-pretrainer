import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("not-found");
  })
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock
}));

import MediaGlossaryRoute from "@/app/media/[mediaSlug]/glossary/page";

describe("media glossary route", () => {
  beforeEach(() => {
    notFoundMock.mockClear();
  });

  it("returns 404 instead of preserving legacy local glossary urls", async () => {
    await expect(
      MediaGlossaryRoute({
        params: Promise.resolve({
          mediaSlug: "fixture-tcg"
        }),
        searchParams: Promise.resolve({
          q: "iku",
          segment: "segment_fixture_starter_core"
        })
      })
    ).rejects.toThrow("not-found");

    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
