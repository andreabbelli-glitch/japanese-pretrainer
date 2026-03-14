import { expect, test } from "@playwright/test";

test("keeps the glossary portal state while moving from global search to local detail and back", async ({
  page
}) => {
  await page.goto("/glossary?q=kosuto&cards=with_cards");

  const glossaryNav = page.locator('.site-nav__link[href="/glossary"]');

  await expect(page).toHaveURL(/\/glossary\?q=kosuto&cards=with_cards$/);
  await expect(glossaryNav).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("searchbox", { name: "Cerca" })).toHaveValue(
    "kosuto"
  );
  await expect(page.getByRole("combobox", { name: "Flashcard" })).toHaveValue(
    "with_cards"
  );
  await expect(page.getByRole("heading", { name: "コスト" }).first()).toBeVisible();

  const detailLink = page
    .getByRole("link", { name: /Apri il dettaglio locale di/i })
    .first();

  await expect(detailLink).toHaveAttribute(
    "href",
    /\/media\/duel-masters-dm25\/glossary\/term\/term-cost\?returnTo=%2Fglossary%3Fq%3Dkosuto%26cards%3Dwith_cards$/
  );

  await detailLink.click();

  await expect(page).toHaveURL(
    /\/media\/duel-masters-dm25\/glossary\/term\/term-cost\?returnTo=%2Fglossary%3Fq%3Dkosuto%26cards%3Dwith_cards$/
  );
  await expect(glossaryNav).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Torna al Glossary" })).toHaveAttribute(
    "href",
    "/glossary?q=kosuto&cards=with_cards"
  );

  await page.getByRole("link", { name: "Torna al Glossary" }).click();

  await expect(page).toHaveURL(/\/glossary\?q=kosuto&cards=with_cards$/);
  await expect(glossaryNav).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("combobox", { name: "Flashcard" })).toHaveValue(
    "with_cards"
  );
});
