import { expect, test } from "@playwright/test";

test("starts a Katakana Speed session and persists a recap", async ({
  page
}) => {
  await page.goto("/katakana-speed");

  await expect(
    page.getByRole("heading", { name: "Katakana Speed" }).first()
  ).toBeVisible();

  await page.getByText("Scegli esercizio").click();
  await page
    .getByRole("button", { name: /Pseudo/ })
    .first()
    .click();

  await expect(page).toHaveURL(/\/katakana-speed\/session\/[^/]+$/);
  await expect(page.locator(".site-header")).toHaveCount(0);
  await expect(page.locator(".katakana-speed-stage")).toBeVisible();
  await expect(page.locator(".katakana-speed-task-copy")).toBeVisible();

  await page
    .locator(".katakana-speed-stage button:not([disabled])")
    .first()
    .focus();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Mostra lettura")).toBeChecked();
  await expect(
    page.locator(".katakana-speed-reading-hint strong").first()
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Mostra lettura")).not.toBeChecked();
  await page.getByLabel("Mostra lettura").focus();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Mostra lettura")).toBeChecked();

  await page.keyboard.press("1");

  await expect(page.locator(".katakana-speed-session-top")).toContainText(
    "2 / 12"
  );
  await expect(page.getByLabel("Mostra lettura")).not.toBeChecked();

  await page.getByRole("button", { name: "Abbandona e salva recap" }).click();

  await expect(page).toHaveURL(/\/katakana-speed\/recap\/[^/]+$/);
  await expect(page.locator(".katakana-speed-recap-page")).toBeVisible();
  await expect(page.getByText("Risposte registrate")).toBeVisible();
  await expect(page.locator(".katakana-speed-attempt-row")).toHaveCount(1);
});

test("uses Space for readings and Enter for the timed RAN flow", async ({
  page
}) => {
  await page.goto("/katakana-speed");

  await page.getByText("Scegli esercizio").click();
  await page
    .getByRole("button", { name: /Griglia/ })
    .first()
    .click();

  await expect(page).toHaveURL(/\/katakana-speed\/session\/[^/]+$/);
  await expect(page.locator(".katakana-speed-ran-grid")).toBeVisible();

  await page.locator(".katakana-speed-ran-cell").first().focus();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Mostra lettura")).toBeChecked();
  await expect(
    page.locator(".katakana-speed-reading-hint strong").first()
  ).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Timer fermo" })).toBeVisible();
  await expect(page.locator(".katakana-speed-ran-cell").first()).toBeEnabled();

  await page.getByRole("button", { name: "Abbandona e salva recap" }).click();
  await expect(page).toHaveURL(/\/katakana-speed\/recap\/[^/]+$/);
});

test("renders comparative prompts as separated readable rows", async ({
  page
}) => {
  await page.goto("/katakana-speed");

  await page.getByText("Scegli esercizio").click();
  await page
    .getByRole("button", { name: /Varianti/ })
    .first()
    .click();

  await expect(page).toHaveURL(/\/katakana-speed\/session\/[^/]+$/);
  const rows = page.locator(".katakana-speed-comparison-prompt__item");
  await expect(rows).toHaveCount(2);

  const firstBox = await rows.nth(0).boundingBox();
  const secondBox = await rows.nth(1).boundingBox();
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(secondBox!.y).toBeGreaterThan(firstBox!.y + firstBox!.height);

  const firstFontSize = await rows.nth(0).evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).fontSize)
  );
  expect(firstFontSize).toBeLessThanOrEqual(88);

  await page.getByRole("button", { name: "Abbandona e salva recap" }).click();
  await expect(page).toHaveURL(/\/katakana-speed\/recap\/[^/]+$/);
});
