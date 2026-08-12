import { expect, test } from "@playwright/test";

import { expectReviewReady } from "./helpers/review-page";
import { testIds } from "./helpers/selectors";

const canonicalMediaSlug = "duel-masters-dm25";
const activeMediaSlugs = [
  "crystal-hunters",
  canonicalMediaSlug,
  "gundam-arsenal-base",
  "kaishi-15k",
  "migaku-grammar",
  "pokemon-scarlet-violet",
  "tcg-generale",
  "web-giapponese"
] as const;

test("lists every active media and smokes one canonical study flow", async ({
  page
}) => {
  await page.goto("/media");

  const mediaLinks = page.locator(".library-card__overlay-link");

  await expect(mediaLinks).toHaveCount(activeMediaSlugs.length);

  for (const mediaSlug of activeMediaSlugs) {
    await expect(
      page.locator(`.library-card__overlay-link[href="/media/${mediaSlug}"]`)
    ).toBeVisible();
  }

  await page.goto(`/media/${canonicalMediaSlug}`);

  await expect(page).toHaveURL(`/media/${canonicalMediaSlug}`);
  await expect(page.getByTestId(testIds.mediaDetailPage)).toBeVisible();
  await expect(page.getByTestId(testIds.entryPointGrid)).toContainText(
    "Textbook"
  );
  await expect(page.getByTestId(testIds.entryPointGrid)).toContainText(
    "Glossary"
  );
  await expect(page.getByTestId(testIds.entryPointGrid)).toContainText(
    "Review"
  );

  await page.goto(`/media/${canonicalMediaSlug}/textbook`);

  await expect(page).toHaveURL(`/media/${canonicalMediaSlug}/textbook`);
  const firstLessonLink = page.getByTestId(testIds.textbookLessonLink).first();
  await expect(firstLessonLink).toBeVisible();

  await firstLessonLink.click();

  await expect(page).toHaveURL(
    new RegExp(`/media/${canonicalMediaSlug}/textbook/[^/?#]+$`)
  );
  await expect(page.getByTestId(testIds.readerArticle).first()).toBeVisible();

  await page.goto(`/glossary?media=${canonicalMediaSlug}`);

  await expect(page).toHaveURL(`/glossary?media=${canonicalMediaSlug}`);
  await expect(page.getByRole("combobox", { name: "Media" })).toHaveValue(
    canonicalMediaSlug
  );
  await expect(page.getByTestId(testIds.glossaryPortalResults)).toBeVisible();

  await page.goto(`/media/${canonicalMediaSlug}/review`);

  await expect(page).toHaveURL(
    new RegExp(`/media/${canonicalMediaSlug}/review(?:\\?.*)?$`)
  );
  await expect(page.getByTestId(testIds.reviewPage)).toBeVisible();
  await expectReviewReady(page);

  await page.goto(`/media/${canonicalMediaSlug}/progress`);

  await expect(page).toHaveURL(
    new RegExp(`/media/${canonicalMediaSlug}(?:#overview)?$`)
  );
  await expect(page.getByTestId(testIds.mediaDetailPage)).toBeVisible();
});
