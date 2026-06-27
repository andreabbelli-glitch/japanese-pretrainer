import type { DashboardData } from "@/features/dashboard/server";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { mediaTextbookLessonHref } from "@/features/navigation";

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
    expect(markup).toContain("non hai ancora completato");
    expect(markup).toContain("Seconda Lesson");
    expect(markup).toContain("Media Fixture");
    expect(markup).toContain('href="/media/media-fixture/textbook/seconda"');
  });

  it("opens the textbook index without continue copy when completed media has no resume lesson", () => {
    const markup = renderToStaticMarkup(
      DashboardHome({ data: buildDashboardData() })
    );

    expect(markup).toContain(
      '<a class="button button--primary" href="/media/media-fixture/textbook">Apri Textbook</a>'
    );
    expect(markup).toContain(
      "Percorso completato. Apri il Textbook per rileggere dall&#x27;inizio."
    );
  });

  it("keeps the primary continue CTA for incomplete media with a resume lesson", () => {
    const markup = renderToStaticMarkup(
      DashboardHome({
        data: buildDashboardData({
          focusMedia: buildMediaSnapshot({
            lessonsCompleted: 1,
            lessonsTotal: 2,
            nextLesson: {
              slug: "seconda",
              title: "Seconda Lesson",
              summary: "Seconda",
              excerpt: "Seconda",
              status: "not_started" as const,
              statusLabel: "Da iniziare",
              segmentTitle: "Percorso principale"
            },
            resumeLesson: {
              slug: "seconda",
              title: "Seconda Lesson",
              summary: "Seconda",
              excerpt: "Seconda",
              status: "not_started" as const,
              statusLabel: "Da iniziare",
              segmentTitle: "Percorso principale"
            },
            textbookProgressPercent: 50
          })
        })
      })
    );

    expect(markup).toContain(
      '<a class="button button--primary" href="/media/media-fixture/textbook/seconda">Continua il percorso</a>'
    );
    expect(markup).toContain("Prossimo passo: Seconda Lesson");
  });
});

function buildDashboardData(
  overrides: Partial<Pick<DashboardData, "focusMedia" | "reviewMedia" | "media">> = {}
): DashboardData {
  const focusMedia = overrides.focusMedia ?? buildMediaSnapshot();
  const reviewMedia = overrides.reviewMedia ?? buildMediaSnapshot();
  const media = overrides.media ?? [focusMedia];

  return {
    focusMedia,
    reviewMedia,
    media,
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

function buildMediaSnapshot(
  overrides: Partial<NonNullable<DashboardData["focusMedia"]>> = {}
): NonNullable<DashboardData["focusMedia"]> {
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
    latestCompletedLessonAt: null,
    resumeLesson: null,
    nextLesson: null,
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
    },
    ...overrides
  };
}
