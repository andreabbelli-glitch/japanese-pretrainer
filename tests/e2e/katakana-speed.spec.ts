import { expect, test } from "@playwright/test";

test("starts a Katakana Speed session and persists a recap", async ({
  page
}) => {
  await page.goto("/katakana-speed");

  await expect(
    page.getByRole("heading", { name: "Katakana Speed" }).first()
  ).toBeVisible();

  await expect(page.getByRole("button", { name: "Start 5 min" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Diagnosi" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ripara debolezza" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Start 5 min" }).click();

  await expect(page).toHaveURL(/\/katakana-speed\/session\/[^/]+$/);
  await expect(page.locator(".site-header")).toHaveCount(0);
  await expect(page.locator(".katakana-speed-stage")).toBeVisible();
  await expect(page.locator(".katakana-speed-task-copy")).toBeVisible();

  await page.locator(".katakana-speed-stage").focus();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Mostra lettura")).toBeDisabled();
  await expect(page.locator(".katakana-speed-reading-hint strong")).toHaveCount(
    0
  );

  const optionButtons = page.locator(".katakana-speed-option");
  await optionButtons.first().click();
  const continueButton = page.getByRole("button", { name: "Continua" });
  try {
    await continueButton.waitFor({ state: "visible", timeout: 1000 });
    await continueButton.click();
  } catch {
    // Correct objective choices advance immediately.
  }

  await expect(page.locator(".katakana-speed-session-top")).toContainText(
    "2 / 32"
  );
  await expect(page.getByLabel("Mostra lettura")).not.toBeChecked();

  await page.getByRole("button", { name: "Abbandona e salva recap" }).click();

  await expect(page).toHaveURL(/\/katakana-speed\/recap\/[^/]+$/);
  await expect(page.locator(".katakana-speed-recap-page")).toBeVisible();
  await expect(page.getByText("Risposte registrate")).toBeVisible();
  await expect(page.locator(".katakana-speed-attempt-row")).toHaveCount(1);
});

test("shows guided actions and the manual Katakana Speed selector", async ({
  page
}) => {
  await page.goto("/katakana-speed");

  await expect(page.getByRole("button", { name: "Start 5 min" })).toHaveCount(
    1
  );
  await expect(page.getByRole("button", { name: "Diagnosi" })).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Ripara debolezza" })
  ).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Esercizio manuale" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Romaji -> katakana" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Griglia RAN" })).toBeVisible();
  await expect(page.getByText("Modalità avanzate / debug")).toHaveCount(0);
});

test("includes inverse romaji-to-katakana choices without reading hints", async ({
  page
}) => {
  await page.goto("/katakana-speed");
  await page.getByRole("button", { name: "Start 5 min" }).click();

  await expect(page.locator(".katakana-speed-task-copy")).toContainText(
    "romaji"
  );
  await expect(page.locator(".katakana-speed-prompt")).toHaveText(/^[a-z]+$/iu);
  await expect(page.getByLabel("Mostra lettura")).toBeDisabled();
  const optionSurfaces = await page
    .locator(".katakana-speed-option__surface")
    .allTextContents();

  expect(optionSurfaces).toHaveLength(4);
  expect(new Set(optionSurfaces.map((surface) => surface.trim())).size).toBe(4);
  expect(
    optionSurfaces.every((surface) =>
      /^[\u30a0-\u30ffー]+$/u.test(surface.trim())
    )
  ).toBe(true);

  await page.keyboard.press("Space");
  await expect(page.locator(".katakana-speed-reading-hint")).toHaveCount(0);
});

test("starts a manual RAN Grid exercise with varied cells", async ({
  page
}) => {
  await page.goto("/katakana-speed");
  await page.getByRole("button", { name: "Griglia RAN" }).click();

  await expect(page).toHaveURL(/\/katakana-speed\/session\/[^/]+$/);
  await expect(page.locator(".katakana-speed-stage__meta")).toContainText(
    "Griglia di velocita"
  );
  const cellSurfaces = await page
    .locator(".katakana-speed-ran-cell span:first-child")
    .allTextContents();

  expect(cellSurfaces).toHaveLength(25);
  expect(
    new Set(cellSurfaces.map((surface) => surface.trim())).size
  ).toBeGreaterThanOrEqual(8);
  expect(cellSurfaces.map((surface) => surface.trim())).not.toContain("ー");
});

test("keeps low-value legacy modes out of the picker", async ({ page }) => {
  await page.goto("/katakana-speed");

  await expect(
    page.getByRole("button", { name: /Solo griglia RAN/ })
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Solo pseudo/ })).toHaveCount(
    0
  );
  await expect(page.getByRole("button", { name: /Solo lettura/ })).toHaveCount(
    0
  );
  await expect(
    page.getByRole("button", { name: /Solo contrasti/ })
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Varianti/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Costruisci/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Chunk$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Rare$/ })).toHaveCount(0);
});
