import { expect, test } from "@playwright/test";

test("covers dashboard, reader, glossary, review, progress, settings and review redirect", async ({
  page
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Duel Masters" })
  ).toBeVisible();
  await page.getByRole("link", { name: "Apri media" }).first().click();

  await expect(page).toHaveURL(/\/media\/duel-masters-dm25$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Duel Masters" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Riprendi lesson" }).click();

  await expect(page).toHaveURL(
    /\/media\/duel-masters-dm25\/textbook\/tcg-core-overview$/
  );
  await expect(
    page.getByRole("heading", { name: /TCG Core - Entrare nel gioco/ })
  ).toBeVisible();

  const rubyReading = page.locator("ruby rt").first();
  await expect(rubyReading).toBeHidden();

  const furiganaControl = page.getByRole("group", {
    name: "Controllo furigana"
  });

  await furiganaControl
    .getByRole("button", { name: "On", exact: true })
    .click();
  await expect(rubyReading).toBeVisible();

  await furiganaControl
    .getByRole("button", { name: "Hover", exact: true })
    .click();
  await expect(rubyReading).toBeHidden();

  await page.getByRole("button", { name: "クリーチャー" }).first().click();
  const entryTooltip = page.locator(".entry-tooltip-card");

  await expect(
    entryTooltip.getByRole("heading", { name: "クリーチャー" })
  ).toBeVisible();
  const entryLink = entryTooltip.getByRole("link", { name: "Apri entry" });

  await expect(entryLink).toHaveAttribute(
    "href",
    "/media/duel-masters-dm25/glossary/term/term-creature"
  );
  const entryHref = await entryLink.getAttribute("href");

  expect(entryHref).not.toBeNull();
  await page.goto(entryHref!);

  await expect(page).toHaveURL(
    /\/media\/duel-masters-dm25\/glossary\/term\/term-creature$/
  );
  await expect(
    page.locator(".glossary-entry-hero__meaning").getByText("creatura")
  ).toBeVisible();

  await page.goto("/media/duel-masters-dm25/glossary");
  await page.getByRole("searchbox", { name: "Cerca" }).fill("bochi");
  await page.getByRole("button", { name: "Cerca" }).click();

  await expect(page.getByRole("heading", { name: '"bochi"' })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "墓地" }).first()
  ).toBeVisible();
  await page.getByRole("link", { name: "Apri detail page" }).first().click();

  await expect(page).toHaveURL(
    /\/media\/duel-masters-dm25\/glossary\/term\/term-graveyard$/
  );
  await expect(
    page
      .locator(".glossary-entry-hero__meaning")
      .getByText("cimitero / graveyard")
  ).toBeVisible();

  await page.goto("/review");
  await expect(page).toHaveURL(/\/media\/duel-masters-dm25\/review$/);
  const initialReviewFront = await page
    .locator(".review-stage__front")
    .textContent();

  expect(initialReviewFront?.trim().length).toBeGreaterThan(0);

  await page.getByRole("link", { name: "Mostra risposta" }).click();
  await page.getByRole("button", { name: /^Good/ }).click();

  await expect(page).toHaveURL(/answered=1/);
  await expect(
    page.locator(".stat-block").filter({ hasText: "Risposte" })
  ).toContainText("1");
  await expect(page.locator(".review-stage__front")).not.toHaveText(
    initialReviewFront ?? ""
  );

  await page.goto("/media/duel-masters-dm25/progress");
  await expect(
    page.getByRole("heading", { name: "Duel Masters" })
  ).toBeVisible();
  await expect(page.getByText("Furigana")).toBeVisible();
  await expect(page.getByText("hover")).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("radio", { name: /Ordine percorso/ }).check();
  await page.getByRole("button", { name: "Salva preferenze" }).click();

  await expect(page).toHaveURL(/saved=1/);
  await expect(page.getByRole("status")).toContainText("Preferenze salvate");

  await page.goto("/media/duel-masters-dm25/glossary");
  await expect(page.getByRole("combobox", { name: "Ordine" })).toHaveValue(
    "lesson_order"
  );
});
