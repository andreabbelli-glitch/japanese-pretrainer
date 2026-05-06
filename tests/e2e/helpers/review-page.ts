import { expect, type Page } from "@playwright/test";

import { testIds } from "./selectors";

export function reviewReadyLocator(page: Page) {
  return page
    .getByTestId(testIds.reviewStage)
    .or(page.getByTestId(testIds.emptyState))
    .first();
}

export async function expectReviewReady(page: Page) {
  await expect(reviewReadyLocator(page)).toBeVisible();
}

export async function revealReviewAnswer(page: Page) {
  await page.getByRole("button", { name: "Mostra risposta" }).click();
  await expect(page.getByTestId(testIds.reviewAnswer)).toBeVisible();
}

export async function gradeReview(page: Page, gradeName: RegExp | string) {
  await page.getByRole("button", { name: gradeName }).click();
}

export function reviewFrontLocator(page: Page) {
  return page.getByTestId(testIds.reviewStage).getByRole("heading").first();
}

export async function readReviewPageSignature(page: Page) {
  const stage = page.getByTestId(testIds.reviewStage);

  if ((await stage.count()) > 0) {
    return {
      kind: "stage" as const,
      value: [
        (
          (await page.getByTestId(testIds.reviewChips).textContent()) ?? ""
        ).trim(),
        ((await reviewFrontLocator(page).textContent()) ?? "").trim()
      ].join(" | ")
    };
  }

  return {
    kind: "empty" as const,
    value: (
      (await page.getByTestId(testIds.emptyState).textContent()) ?? ""
    ).trim()
  };
}
