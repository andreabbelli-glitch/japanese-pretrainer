import { expect, type Locator, type Page } from "@playwright/test";

import { testIds } from "./selectors";

export async function startKatakanaSpeedSession(
  page: Page,
  label = "Start 5 min"
) {
  await page.getByRole("button", { name: label }).click();
  await expect(page).toHaveURL(/\/katakana-speed\/session\/[^/]+$/);
  await expect(page.getByTestId(testIds.katakanaSpeedStage)).toBeVisible();
}

export function katakanaSpeedOptions(page: Page) {
  return page.getByTestId(testIds.katakanaSpeedOption);
}

export function katakanaSpeedOptionSurfaces(page: Page) {
  return page.getByTestId(testIds.katakanaSpeedOptionSurface);
}

export function katakanaSpeedRanCells(page: Page) {
  return page.getByTestId(testIds.katakanaSpeedRanCell);
}

export async function continueIfVisible(page: Page) {
  const continueButton = page.getByRole("button", { name: "Continua" });
  const progress = page.getByTestId(testIds.katakanaSpeedTop);

  await expect
    .poll(async () => {
      if (await continueButton.isVisible().catch(() => false)) {
        return "continue";
      }

      const progressText = (await progress.textContent().catch(() => "")) ?? "";

      if (progressText.includes("2 / 32")) {
        return "advanced";
      }

      return "waiting";
    })
    .not.toBe("waiting");

  if (await continueButton.isVisible().catch(() => false)) {
    await continueButton.click();
  }
}

export async function readAllText(locator: Locator) {
  return (await locator.allTextContents()).map((value) => value.trim());
}
