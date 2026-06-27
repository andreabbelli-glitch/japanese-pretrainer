import { describe, expect, it } from "vitest";

import {
  pickFocusMedia,
  type MediaShellSnapshot
} from "@/features/media/server";

describe("media shell snapshot", () => {
  it("puts the media with the most recently completed lesson in focus", () => {
    const activeEarlierCompletion = buildMediaSnapshot({
      activeLesson: {
        slug: "next",
        title: "Next Lesson",
        status: "in_progress",
        statusLabel: "In corso"
      },
      latestCompletedLessonAt: "2026-04-10T09:00:00.000Z",
      slug: "active-earlier-completion",
      title: "Active Earlier Completion"
    });
    const latestCompletion = buildMediaSnapshot({
      latestCompletedLessonAt: "2026-04-12T09:00:00.000Z",
      slug: "latest-completion",
      title: "Latest Completion"
    });

    expect(
      pickFocusMedia([activeEarlierCompletion, latestCompletion])?.slug
    ).toBe("latest-completion");
  });
});

function buildMediaSnapshot(
  overrides: Partial<MediaShellSnapshot> &
    Pick<MediaShellSnapshot, "slug" | "title">
): MediaShellSnapshot {
  const { slug, title, ...rest } = overrides;

  return {
    activeLesson: null,
    activeReviewCards: 0,
    cardsDue: 0,
    cardsTotal: 0,
    description: `${title} description`,
    entriesKnown: 0,
    entriesTotal: 0,
    glossary: {
      breakdown: {
        available: 0,
        known: 0,
        learning: 0,
        new: 0,
        review: 0
      },
      entriesCovered: 0,
      entriesTotal: 0,
      previewEntries: [],
      progressPercent: null
    },
    glossaryProgressPercent: null,
    id: slug,
    inProgressLessons: 0,
    lastOpenedLesson: null,
    latestCompletedLessonAt: null,
    lessonsCompleted: 0,
    lessonsTotal: 0,
    mediaType: "game",
    mediaTypeLabel: "Videogioco",
    nextLesson: null,
    previewEntries: [],
    resumeLesson: null,
    reviewQueueLabel: "Nessuna review",
    reviewStatDetail: "Nessuna review",
    reviewStatValue: "0",
    segmentKindLabel: "Capitoli",
    segments: [],
    slug,
    statusLabel: "Attivo",
    textbookProgressPercent: null,
    title,
    ...rest
  };
}
