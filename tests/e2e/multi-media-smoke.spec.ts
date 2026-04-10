import { expect, test } from "@playwright/test";

const canonicalMediaSlug = "duel-masters-dm25";

test("smokes core study routes for duel-masters-dm25", async ({ page }) => {
  await page.goto("/media");

  await expect(
    page
      .locator(
        `.library-card__overlay-link[href="/media/${canonicalMediaSlug}"]`
      )
      .first()
  ).toBeVisible();

  await page.goto(`/media/${canonicalMediaSlug}`);

  await expect(page).toHaveURL(`/media/${canonicalMediaSlug}`);
  await expect(page.locator(".media-detail-page")).toBeVisible();
  await expect(page.locator(".entry-point-grid")).toContainText("Textbook");
  await expect(page.locator(".entry-point-grid")).toContainText("Glossary");
  await expect(page.locator(".entry-point-grid")).toContainText("Review");

  await page.goto(`/media/${canonicalMediaSlug}/textbook`);

  await expect(page).toHaveURL(`/media/${canonicalMediaSlug}/textbook`);
  const firstLessonLink = page.locator(".textbook-lesson-link").first();
  await expect(firstLessonLink).toBeVisible();

  await firstLessonLink.click();

  await expect(page).toHaveURL(
    new RegExp(`/media/${canonicalMediaSlug}/textbook/[^/?#]+$`)
  );
  await expect(page.locator(".reader-article").first()).toBeVisible();

  await page.goto(`/media/${canonicalMediaSlug}/glossary`);

  await expect(page).toHaveURL(`/glossary?media=${canonicalMediaSlug}`);
  await expect(page.getByRole("combobox", { name: "Media" })).toHaveValue(
    canonicalMediaSlug
  );
  await expect(page.locator(".glossary-results--portal")).toBeVisible();

  await page.goto(`/media/${canonicalMediaSlug}/review`);

  await expect(page).toHaveURL(
    new RegExp(`/media/${canonicalMediaSlug}/review(?:\\?.*)?$`)
  );
  await expect(page.locator(".review-page")).toBeVisible();
  await expect(page.locator(".review-stage, .empty-state").first()).toBeVisible();

  await page.goto(`/media/${canonicalMediaSlug}/progress`);

  await expect(page).toHaveURL(
    new RegExp(`/media/${canonicalMediaSlug}(?:#overview)?$`)
  );
  await expect(page.locator(".media-detail-page")).toBeVisible();
});
