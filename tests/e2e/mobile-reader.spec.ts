import { expect, test } from "@playwright/test";

test.use({
  viewport: {
    width: 390,
    height: 844
  }
});

test("keeps reader interactions usable on mobile", async ({ page }) => {
  await page.goto("/media/duel-masters-dm25/textbook/tcg-core-overview");

  await expect(page.getByRole("button", { name: "Lezioni" })).toBeVisible();
  await expect(page.getByText("Furigana:")).toBeVisible();

  await page.getByRole("button", { name: "クリーチャー" }).first().click();
  const mobileSheet = page.getByRole("dialog");
  await expect(
    mobileSheet.getByRole("heading", { name: "クリーチャー" })
  ).toBeVisible();
  await expect(mobileSheet.getByRole("link", { name: "Apri entry" })).toBeVisible();

  await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  await page.getByRole("button", { name: "Lezioni" }).click();

  await expect(page.getByRole("dialog")).toContainText("Percorso del media");
  await expect(
    page.getByRole("dialog").getByRole("link", {
      name: /TCG Core - Pattern del testo effetto/
    })
  ).toBeVisible();
});
