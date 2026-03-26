import { expect, test } from "@playwright/test";

import { escapeRegex, listWorkspaceMediaSlugs } from "./helpers/media-slugs";

const mediaSlugs = listWorkspaceMediaSlugs();

if (mediaSlugs.length === 0) {
  throw new Error("Expected at least one media bundle in content/media for E2E smoke coverage.");
}

for (const mediaSlug of mediaSlugs) {
  const mediaSlugPattern = escapeRegex(mediaSlug);

  test(`smokes core study routes for ${mediaSlug}`, async ({ page }) => {
    await page.goto("/media");

    await expect(
      page.locator(`.library-card__overlay-link[href="/media/${mediaSlug}"]`).first()
    ).toBeVisible();

    await page.goto(`/media/${mediaSlug}`);

    await expect(page).toHaveURL(new RegExp(`/media/${mediaSlugPattern}$`));
    await expect(page.locator(".media-detail-page")).toBeVisible();
    await expect(page.locator(".entry-point-grid")).toContainText("Textbook");
    await expect(page.locator(".entry-point-grid")).toContainText("Glossary");
    await expect(page.locator(".entry-point-grid")).toContainText("Review");

    await page.goto(`/media/${mediaSlug}/textbook`);

    await expect(page).toHaveURL(
      new RegExp(`/media/${mediaSlugPattern}/textbook$`)
    );
    const firstLessonLink = page.locator(".textbook-lesson-link").first();
    await expect(firstLessonLink).toBeVisible();

    await firstLessonLink.click();

    await expect(page).toHaveURL(
      new RegExp(`/media/${mediaSlugPattern}/textbook/[^/?#]+$`)
    );
    await expect(page.locator(".reader-article").first()).toBeVisible();

    await page.goto(`/media/${mediaSlug}/glossary`);

    await expect(page).toHaveURL(
      new RegExp(`/glossary\\?media=${mediaSlugPattern}(?:$|&)`)
    );
    await expect(page.getByRole("combobox", { name: "Media" })).toHaveValue(
      mediaSlug
    );
    await expect(page.locator(".glossary-results--portal")).toBeVisible();

    await page.goto(`/media/${mediaSlug}/review`);

    await expect(page).toHaveURL(
      new RegExp(`/media/${mediaSlugPattern}/review(?:\\?.*)?$`)
    );
    await expect(page.locator(".review-page")).toBeVisible();
    await expect(page.locator(".review-stage, .empty-state").first()).toBeVisible();

    await page.goto(`/media/${mediaSlug}/progress`);

    await expect(page).toHaveURL(
      new RegExp(`/media/${mediaSlugPattern}(?:#overview)?$`)
    );
    await expect(page.locator(".media-detail-page")).toBeVisible();
  });
}
