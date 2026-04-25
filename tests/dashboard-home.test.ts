import type { DashboardData } from "@/lib/dashboard";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardHome } from "@/components/dashboard/dashboard-home";

describe("dashboard home", () => {
  it("shows queued new cards in the global review card", () => {
    const markup = renderToStaticMarkup(
      DashboardHome({ data: buildDashboardData() })
    );

    expect(markup).toContain("In coda oggi");
    expect(markup).toContain("Hai 1 nuova card pronta");
    expect(markup).toContain(">1<");
    expect(markup).toContain("1 card nuova è pronta per oggi.");
  });
});

function buildDashboardData(): DashboardData {
  return {
    focusMedia: buildMediaSnapshot(),
    reviewMedia: buildMediaSnapshot(),
    media: [buildMediaSnapshot()],
    review: {
      activeReviewCards: 0,
      cardsDue: 0,
      queueCount: 1,
      newQueuedCount: 1,
      queueLabel: "1 card nuova è pronta per oggi."
    },
    totals: {
      lessonsCompleted: 1,
      lessonsTotal: 1,
      entriesKnown: 2,
      entriesTotal: 2
    }
  };
}

function buildMediaSnapshot() {
  return {
    id: "media_fixture",
    slug: "media-fixture",
    title: "Media Fixture",
    description: "Fixture dashboard",
    mediaType: "game",
    mediaTypeLabel: "Videogioco",
    segmentKindLabel: "Capitoli",
    statusLabel: "Attivo",
    lessonsCompleted: 1,
    lessonsTotal: 1,
    textbookProgressPercent: 100,
    entriesKnown: 2,
    entriesTotal: 2,
    glossaryProgressPercent: 100,
    cardsDue: 0,
    cardsTotal: 1,
    activeReviewCards: 0,
    reviewStatValue: "Nuove pronte",
    reviewStatDetail: "Sessione pronta",
    reviewQueueLabel: "1 card nuova è pronta per oggi.",
    inProgressLessons: 0,
    activeLesson: null,
    lastOpenedLesson: null,
    resumeLesson: {
      slug: "intro",
      title: "Intro",
      summary: "Intro",
      excerpt: "Intro",
      status: "completed" as const,
      statusLabel: "Completata",
      segmentTitle: "Percorso principale"
    },
    nextLesson: {
      slug: "intro",
      title: "Intro",
      summary: "Intro",
      excerpt: "Intro",
      status: "completed" as const,
      statusLabel: "Completata",
      segmentTitle: "Percorso principale"
    },
    segments: [],
    previewEntries: [],
    glossary: {
      breakdown: {
        available: 0,
        known: 2,
        learning: 0,
        new: 0,
        review: 0
      },
      entriesCovered: 2,
      entriesTotal: 2,
      previewEntries: [],
      progressPercent: 100
    }
  };
}
