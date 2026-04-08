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
  await expect(mobileSheet).not.toContainText("Livello:");
  await expect(mobileSheet).not.toContainText("Segmento:");
  const pronunciationAudio = mobileSheet.locator(
    "audio.pronunciation-audio__player"
  );
  await expect(pronunciationAudio).toHaveAttribute("preload", "none");
  await page.waitForTimeout(250);
  await expect(pronunciationAudio).toHaveAttribute("preload", "auto");
  await expect(mobileSheet.getByRole("link", { name: "Apri voce" })).toBeVisible();

  await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  await page.getByRole("button", { name: "Lezioni" }).click();

  await expect(page.getByRole("dialog")).toContainText("Percorso del media");
  await expect(
    page.getByRole("dialog").getByRole("link", {
      name: /TCG Core - Montare il testo effetto/
    })
  ).toBeVisible();
});

test("opens textbook screenshots in a lightbox on mobile", async ({ page }) => {
  await page.goto(
    "/media/duel-masters-dm25/textbook/duel-plays-app-modes-and-progression"
  );

  await page
    .getByRole("button", {
      name: /Apri immagine ingrandita: Schermata Battle di デュエプレ/
    })
    .click();

  const lightbox = page.getByRole("dialog", {
    name: "Immagine ingrandita"
  });

  await expect(lightbox).toBeVisible();
  await expect(
    lightbox.getByRole("img", {
      name: /Schermata Battle di デュエプレ/
    })
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(lightbox).toBeHidden();
});

test("opens card images in a lightbox on mobile too", async ({ page }) => {
  await page.goto("/media/duel-masters-dm25/textbook/tcg-core-overview");

  await page
    .getByRole("button", {
      name: /Apri immagine ingrandita: Carta di アビスベル=ジャシンてい/
    })
    .first()
    .click();

  const lightbox = page.getByRole("dialog", {
    name: "Immagine ingrandita"
  });

  await expect(lightbox).toBeVisible();
  await expect(
    lightbox.getByRole("img", {
      name: /Carta di アビスベル=ジャシンてい/
    })
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(lightbox).toBeHidden();
});
