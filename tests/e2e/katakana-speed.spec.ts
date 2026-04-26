import { expect, test } from "@playwright/test";

test("starts a Katakana Speed session and persists a recap", async ({
  page
}) => {
  await page.goto("/katakana-speed");

  await expect(
    page.getByRole("heading", { name: "Katakana Speed" }).first()
  ).toBeVisible();

  await page
    .getByRole("button", { name: /^Start/ })
    .first()
    .click();

  await expect(page).toHaveURL(/\/katakana-speed\/session\/[^/]+$/);
  await expect(page.locator(".site-header")).toHaveCount(0);
  await expect(page.locator(".katakana-speed-stage")).toBeVisible();
  await expect(page.locator(".katakana-speed-option")).toHaveCount(2);

  await page.keyboard.press("1");

  await expect(page.locator(".katakana-speed-session-top")).toContainText(
    "2 / 12"
  );

  await page.getByRole("button", { name: "Abbandona e salva recap" }).click();

  await expect(page).toHaveURL(/\/katakana-speed\/recap\/[^/]+$/);
  await expect(page.locator(".katakana-speed-recap-page")).toBeVisible();
  await expect(page.getByText("Attempt log")).toBeVisible();
  await expect(page.locator(".katakana-speed-attempt-row")).toHaveCount(1);
});
