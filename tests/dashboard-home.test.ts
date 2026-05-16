import type { DashboardData } from "@/lib/dashboard";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { mediaTextbookLessonHref } from "@/lib/site";

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

  it("shows the latest added lessons with direct textbook links", () => {
    const markup = renderToStaticMarkup(
      DashboardHome({ data: buildDashboardData() })
    );

    expect(markup).toContain("Ultime lezioni aggiunte");
    expect(markup).toContain("Seconda Lesson");
    expect(markup).toContain("Media Fixture");
    expect(markup).toContain('href="/media/media-fixture/textbook/seconda"');
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
    },
    recentLessons: [
      {
        createdAt: "2026-03-12T09:00:00.000Z",
        href: mediaTextbookLessonHref("media-fixture", "seconda"),
        id: "lesson-fixture-seconda",
        mediaSlug: "media-fixture",
        mediaTitle: "Media Fixture",
        segmentTitle: "Percorso principale",
        summary: "Una lesson appena aggiunta.",
        title: "Seconda Lesson"
      },
      {
        createdAt: "2026-03-10T09:00:00.000Z",
        href: mediaTextbookLessonHref("media-fixture", "intro"),
        id: "lesson-fixture-intro",
        mediaSlug: "media-fixture",
        mediaTitle: "Media Fixture",
        segmentTitle: "Percorso principale",
        summary: "Intro",
        title: "Intro"
      }
    ]
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
