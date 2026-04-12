import { expect, test } from "@playwright/test";

test("shows autocomplete suggestions and navigates when a suggestion is selected", async ({
  page
}) => {
  await page.goto("/glossary");

  const searchbox = page.getByRole("searchbox", { name: "Cerca" });

  await searchbox.fill("kosu");

  const suggestion = page.getByRole("option", { name: /コスト/i }).first();

  await expect(suggestion).toBeVisible();
  await suggestion.click();

  await expect(page).toHaveURL(
    /\/glossary\?q=%E3%82%B3%E3%82%B9%E3%83%88&type=all&media=all&study=all&cards=all$/
  );
  await expect(searchbox).toHaveValue("コスト");
});

test("hides stale autocomplete suggestions while a new query or filter set is pending", async ({
  page
}) => {
  await page.route("**/api/glossary/autocomplete**", async (route) => {
    if (route.request().url().includes("cards=with_cards")) {
      await new Promise((resolve) => {
        setTimeout(resolve, 200);
      });
    }

    await route.continue();
  });

  await page.goto("/glossary");

  const searchbox = page.getByRole("searchbox", { name: "Cerca" });
  const flashcardFilter = page.getByRole("combobox", { name: "Flashcard" });
  const suggestion = page.getByRole("option", { name: /コスト/i }).first();

  await searchbox.fill("kosu");
  await expect(suggestion).toBeVisible();

  await searchbox.fill("kosuto");
  await expect(suggestion).toBeHidden();

  await searchbox.fill("kosu");
  await expect(suggestion).toBeVisible();

  await flashcardFilter.selectOption("with_cards");
  await expect(suggestion).toBeHidden();
});

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

  const mediaLink = page.locator(".glossary-global-result__media-link").first();

  await expect(page.getByRole("link", { name: "Apri voce" })).toHaveCount(0);
  await expect(mediaLink).toHaveAttribute(
    "href",
    /\/media\/duel-masters-dm25\/glossary\/term\/term-cost\?returnTo=%2Fglossary%3Fq%3Dkosuto%26cards%3Dwith_cards$/
  );

  await mediaLink.click();

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

  await page.getByRole("button", { name: "Azzera i filtri" }).click();

  await expect(page).toHaveURL("/glossary");
  await expect(page.getByRole("searchbox", { name: "Cerca" })).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "Flashcard" })).toHaveValue(
    "all"
  );
});
