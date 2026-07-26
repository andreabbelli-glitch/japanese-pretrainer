import { vi, type Mock } from "vitest";

import type { DatabaseClient } from "@/db";
import type { ReviewPageData } from "@/features/review/server";
import type { ReviewQueueCard } from "@/features/review/types";

export type ReviewPageLoadCall = {
  mediaSlug?: string;
  resolvedMediaRowsLength?: number;
  scope: "global" | "media";
  searchParams: Record<string, string>;
};

export type LoadReviewActionsOptions = {
  getReviewPageData?: (input: {
    mediaSlug: string;
    searchParams: Record<string, string>;
  }) => Promise<ReviewPageData> | ReviewPageData;
  hydrateReviewCard?: (input: {
    cardId: string;
  }) =>
    | Promise<ReviewQueueCard | null | undefined>
    | ReviewQueueCard
    | null
    | undefined;
};

export async function loadReviewActionsForDatabase(
  database: DatabaseClient,
  options: LoadReviewActionsOptions,
  mocks: {
    updateGlossarySummaryCacheMock: Mock;
    updateReviewSummaryCacheMock: Mock;
  }
) {
  const globalDatabase = globalThis as {
    __japaneseCustomStudyDb__?: DatabaseClient;
  };
  const previousDatabase = globalDatabase.__japaneseCustomStudyDb__;
  const reviewPageCalls: ReviewPageLoadCall[] = [];

  try {
    vi.resetModules();
    vi.doMock("@/features/cache/server/data-cache", async () => {
      const actual = await vi.importActual<
        typeof import("@/features/cache/server/data-cache")
      >("@/features/cache/server/data-cache");

      return {
        ...actual,
        updateGlossarySummaryCache: mocks.updateGlossarySummaryCacheMock,
        updateReviewSummaryCache: mocks.updateReviewSummaryCacheMock
      };
    });
    const hydrateReviewCardMock = vi.fn(async (input: { cardId: string }) => {
      if (options.hydrateReviewCard) {
        const hydratedCard = await options.hydrateReviewCard(input);

        if (hydratedCard !== undefined) {
          return hydratedCard;
        }
      }

      const actual = await vi.importActual<
        typeof import("@/features/review/server/card-hydration")
      >("@/features/review/server/card-hydration");

      return actual.hydrateReviewCard(input);
    });
    const getGlobalReviewPageDataMock = vi.fn(
      async (
        searchParams: Record<string, string>,
        _database?: unknown,
        reviewOptions?: {
          resolvedMediaRows?: unknown[];
        }
      ) => {
        reviewPageCalls.push({
          scope: "global",
          searchParams,
          ...(reviewOptions?.resolvedMediaRows
            ? {
                resolvedMediaRowsLength: reviewOptions.resolvedMediaRows.length
              }
            : {})
        });

        return {} as ReviewPageData;
      }
    );
    const getReviewPageDataMock = vi.fn(
      async (
        mediaSlug: string,
        searchParams: Record<string, string>,
        _database?: unknown,
        reviewOptions?: {
          resolvedMediaRows?: unknown[];
        }
      ) => {
        reviewPageCalls.push({
          mediaSlug,
          scope: "media",
          searchParams,
          ...(reviewOptions?.resolvedMediaRows
            ? {
                resolvedMediaRowsLength: reviewOptions.resolvedMediaRows.length
              }
            : {})
        });

        if (options.getReviewPageData) {
          return options.getReviewPageData({ mediaSlug, searchParams });
        }

        return {} as ReviewPageData;
      }
    );
    vi.doMock("@/features/review/server/card-hydration", async () => {
      const actual = await vi.importActual<
        typeof import("@/features/review/server/card-hydration")
      >("@/features/review/server/card-hydration");

      return {
        ...actual,
        hydrateReviewCard: hydrateReviewCardMock
      };
    });
    vi.doMock("@/features/review/server/page-data", async () => {
      const actual = await vi.importActual<
        typeof import("@/features/review/server/page-data")
      >("@/features/review/server/page-data");

      return {
        ...actual,
        getGlobalReviewPageData: getGlobalReviewPageDataMock,
        getReviewPageData: getReviewPageDataMock
      };
    });
    vi.doMock("@/features/review/server", async () => {
      const actual = await vi.importActual<
        typeof import("@/features/review/server")
      >("@/features/review/server");

      return {
        ...actual,
        hydrateReviewCard: hydrateReviewCardMock,
        getGlobalReviewPageData: getGlobalReviewPageDataMock,
        getReviewPageData: getReviewPageDataMock
      };
    });
    globalDatabase.__japaneseCustomStudyDb__ = database;

    return {
      ...(await import("@/actions/review")),
      reviewPageCalls
    };
  } finally {
    globalDatabase.__japaneseCustomStudyDb__ = previousDatabase;
    vi.doUnmock("@/features/cache/server/data-cache");
    vi.doUnmock("@/features/review/server/card-hydration");
    vi.doUnmock("@/features/review/server/page-data");
    vi.doUnmock("@/features/review/server");
  }
}
