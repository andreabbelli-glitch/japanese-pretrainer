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
import MediaGlossaryGrammarDetailRoute from "@/app/media/[mediaSlug]/glossary/grammar/[entryId]/page";
import MediaGlossaryTermDetailRoute from "@/app/media/[mediaSlug]/glossary/term/[entryId]/page";

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

  it("does not wait on unused route props before returning 404", async () => {
    const pendingSearchParams =
      new Promise<Record<string, string | string[] | undefined>>(() => {});
    const pendingMediaParams = new Promise<{ mediaSlug: string }>(() => {});
    const pendingDetailParams =
      new Promise<{ entryId: string; mediaSlug: string }>(() => {});

    const results = await Promise.all([
      immediateRouteResult(
        MediaGlossaryRoute({
          params: pendingMediaParams,
          searchParams: pendingSearchParams
        })
      ),
      immediateRouteResult(
        MediaGlossaryTermDetailRoute({
          params: pendingDetailParams,
          searchParams: pendingSearchParams
        })
      ),
      immediateRouteResult(
        MediaGlossaryGrammarDetailRoute({
          params: pendingDetailParams,
          searchParams: pendingSearchParams
        })
      )
    ]);

    expect(results).toEqual(["not-found", "not-found", "not-found"]);
    expect(notFoundMock).toHaveBeenCalledTimes(3);
  });
});

async function immediateRouteResult(routePromise: Promise<unknown>) {
  return Promise.race([
    routePromise.catch((error: unknown) =>
      error instanceof Error ? error.message : String(error)
    ),
    new Promise((resolve) => {
      setTimeout(() => resolve("still-pending"), 0);
    })
  ]);
}
