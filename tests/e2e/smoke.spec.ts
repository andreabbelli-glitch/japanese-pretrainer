import { expect, test } from "@playwright/test";

test("auth gate reindirizza a login per dashboard/review", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/review");
  await expect(page).toHaveURL(/\/login/);
});

test("apertura lezione e item page", async ({ page }) => {
  await page.goto("/lessons");
  await expect(page.getByRole("heading", { name: /Textbook/ })).toBeVisible();

  const lessonLink = page.locator('a[href^="/lessons/"]').first();
  await lessonLink.click();
  await expect(page).toHaveURL(/\/lessons\//);

  await page.goto("/items/V-001");
  await expect(page.getByText("Scheda item completa", { exact: false })).toBeVisible();
});

test("card page e deck page mostrano coverage", async ({ page }) => {
  await page.goto("/cards/card-sd1-001");
  await expect(page.getByText("Coverage carta", { exact: false })).toBeVisible();

  await page.goto("/decks/dm25-sd1");
  await expect(page.getByText("Coverage complessiva", { exact: false })).toBeVisible();
});
