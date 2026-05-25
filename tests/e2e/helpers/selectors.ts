import { expect, type Locator, type Page } from "@playwright/test";

export const testIds = {
  emptyState: "empty-state",
  entryPointGrid: "entry-point-grid",
  glossaryPortalResults: "glossary-portal-results",
  kanjiClashFeedback: "kanji-clash-feedback",
  kanjiClashOption: (side: "left" | "right") => `kanji-clash-option-${side}`,
  kanjiClashRoundTitle: "kanji-clash-round-title",
  kanjiClashStage: "kanji-clash-stage",
  kanjiClashTargetMeaning: "kanji-clash-target-meaning",
  kanjiClashTargetReading: "kanji-clash-target-reading",
  katakanaSpeedOption: "katakana-speed-option",
  katakanaSpeedOptionSurface: "katakana-speed-option-surface",
  katakanaSpeedPrompt: "katakana-speed-prompt",
  katakanaSpeedAttemptRow: "katakana-speed-attempt-row",
  katakanaSpeedRanCell: "katakana-speed-ran-cell",
  katakanaSpeedRanCellSurface: "katakana-speed-ran-cell-surface",
  katakanaSpeedReadingHint: "katakana-speed-reading-hint",
  katakanaSpeedRecap: "katakana-speed-recap",
  katakanaSpeedStage: "katakana-speed-stage",
  katakanaSpeedStageMeta: "katakana-speed-stage-meta",
  katakanaSpeedTaskCopy: "katakana-speed-task-copy",
  katakanaSpeedTop: "katakana-speed-top",
  mediaDetailPage: "media-detail-page",
  pronunciationAudio: "pronunciation-audio",
  pitchAccentAttemptRow: "pitch-accent-attempt-row",
  pitchAccentOption: "pitch-accent-option",
  pitchAccentRecap: "pitch-accent-recap",
  pitchAccentReviewGraph: "pitch-accent-review-graph",
  pitchAccentStage: "pitch-accent-stage",
  pitchAccentTop: "pitch-accent-top",
  readerArticle: "reader-article",
  reviewAnswer: "review-answer",
  reviewChips: "review-chips",
  reviewPage: "review-page",
  reviewStage: "review-stage",
  statBlock: "stat-block",
  statBlockLabel: "stat-block-label",
  statBlockValue: "stat-block-value",
  textbookLessonLink: "textbook-lesson-link"
} as const;

export function statBlockWithin(root: Locator, label: string) {
  return root.getByTestId(testIds.statBlock).filter({
    has: root.page().getByTestId(testIds.statBlockLabel).filter({
      hasText: label
    })
  });
}

export async function readStatBlockValueWithin(root: Locator, label: string) {
  const value = await statBlockWithin(root, label)
    .getByTestId(testIds.statBlockValue)
    .textContent();

  return Number.parseInt(value ?? "0", 10);
}

export async function readStatBlockValuesWithin(
  root: Locator,
  labels: string[]
) {
  return Object.fromEntries(
    await Promise.all(
      labels.map(async (label) => [
        label,
        await readStatBlockValueWithin(root, label)
      ])
    )
  );
}

export async function readStatBlockValue(page: Page, label: string) {
  return readStatBlockValueWithin(page.locator("body"), label);
}

export async function expectPathname(page: Page, pathname: string) {
  await expect(page).toHaveURL((url) => url.pathname === pathname);
}
