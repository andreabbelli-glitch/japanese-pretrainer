import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MediaLibraryPage } from "@/components/media/media-library-page";
import type { MediaShellSnapshot } from "@/features/media/server";

const mocks = vi.hoisted(() => ({
  getMediaLibraryData: vi.fn()
}));

vi.mock("@/features/media/server", () => ({
  getMediaLibraryData: mocks.getMediaLibraryData
}));

describe("media library page", () => {
  beforeEach(() => {
    mocks.getMediaLibraryData.mockReset();
    mocks.getMediaLibraryData.mockResolvedValue([buildMediaSnapshot()]);
  });

  it("keeps the media card raised while rendering its metrics flat", async () => {
    const markup = renderToStaticMarkup(await MediaLibraryPage());

    expect(markup).toContain(
      "surface-card--default library-card library-card--navigable"
    );
    expect(markup.match(/library-card__metric--flat/g)).toHaveLength(3);
    expect(markup).toContain('href="/media/media-fixture/textbook"');
    expect(markup).toContain('href="/glossary?media=media-fixture"');
    expect(markup).toContain('href="/media/media-fixture/review"');
    expect(markup).toContain('href="/media/media-fixture"');
  });
});

function buildMediaSnapshot(): MediaShellSnapshot {
  return {
    activeLesson: null,
    activeReviewCards: 1,
    cardsDue: 1,
    cardsTotal: 4,
    description: "Fixture della libreria media",
    entriesKnown: 2,
    entriesTotal: 5,
    glossary: {
      breakdown: {
        available: 3,
        known: 1,
        learning: 1,
        new: 2,
        review: 1
      },
      entriesCovered: 2,
      entriesTotal: 5,
      previewEntries: [],
      progressPercent: 40
    },
    glossaryProgressPercent: 40,
    id: "media_fixture",
    inProgressLessons: 0,
    lastOpenedLesson: null,
    latestCompletedLessonAt: null,
    lessonsCompleted: 1,
    lessonsTotal: 3,
    mediaType: "game",
    mediaTypeLabel: "Videogioco",
    nextLesson: null,
    previewEntries: [],
    resumeLesson: null,
    reviewQueueLabel: "1 card richiede attenzione adesso.",
    reviewStatDetail: "Sessione pronta",
    reviewStatValue: "1 da ripassare",
    segmentKindLabel: "Capitoli",
    segments: [],
    slug: "media-fixture",
    statusLabel: "Attivo",
    textbookProgressPercent: 33,
    title: "Media Fixture"
  };
}
