import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConsolidationHubData: vi.fn()
}));

vi.mock("@/features/consolidation/server", () => ({
  getConsolidationHubData: mocks.getConsolidationHubData
}));

import ConsolidationHubRoute from "@/app/consolidation/page";

describe("consolidation hub rendering", () => {
  beforeEach(() => {
    mocks.getConsolidationHubData.mockReset();
  });

  it("explains the study path and separates new cards from review retraining", async () => {
    mocks.getConsolidationHubData.mockResolvedValue({
      mediaGroups: [
        {
          lessons: [
            {
              href: "/consolidation/media/sample/lesson/intro",
              lessonId: "lesson-1",
              lessonSlug: "intro",
              lessonTitle: "Introduzione",
              pendingCount: 3
            }
          ],
          mediaId: "media-1",
          mediaSlug: "sample",
          mediaTitle: "Sample Media",
          pendingCount: 3
        }
      ],
      retrainingQueue: {
        href: "/consolidation/retraining",
        pendingCount: 2,
        title: "Ripasso da review"
      },
      totalPending: 5
    });

    const markup = renderToStaticMarkup(await ConsolidationHubRoute());

    expect(markup).toContain("Lesson completata");
    expect(markup).toContain("Rinforzo");
    expect(markup).toContain("Review");
    expect(markup).toContain("Nuove dalla lesson");
    expect(markup).toContain("Da rinforzare dalla Review");
    expect(markup).toContain("Rinforza 3 card");
    expect(markup).toContain("Rinforza 2 card");
    expect(markup).not.toContain("pre-review");
    expect(markup).not.toContain("queue unica");
    expect(markup).not.toContain("pending");
  });

  it("keeps the path visible when there is nothing to reinforce", async () => {
    mocks.getConsolidationHubData.mockResolvedValue({
      mediaGroups: [],
      retrainingQueue: null,
      totalPending: 0
    });

    const markup = renderToStaticMarkup(await ConsolidationHubRoute());

    expect(markup).toContain("Lesson completata");
    expect(markup).toContain("Non ci sono card da rinforzare.");
    expect(markup).toContain('href="/media"');
  });
});
