import { expect, test, type Page } from "@playwright/test";

async function ensureDuelMastersReviewAvailable(page: Page) {
  await page.goto("/media/duel-masters-dm25/textbook/tcg-core-overview");
  await expect(
    page.getByRole("heading", { name: /TCG Core - Entrare nel gioco/ })
  ).toBeVisible();

  const completeLessonButton = page.getByRole("button", {
    name: "Chiudi lesson"
  });

  if (await completeLessonButton.isVisible().catch(() => false)) {
    await completeLessonButton.click();
    await expect(
      page.getByRole("button", { name: "Riapri lesson" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Vai alla review del capitolo" })
    ).toHaveAttribute(
      "href",
      /\/media\/duel-masters-dm25\/review\?segment=[^&]+$/
    );
  }

  await expect(
    page.getByRole("button", { name: "Riapri lesson" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Vai alla review del capitolo" })
  ).toHaveAttribute(
    "href",
    /\/media\/duel-masters-dm25\/review\?segment=[^&]+$/
  );
}

test("covers dashboard, reader, glossary, review, progress, settings and review redirect", async ({
  page
}) => {
  await page.goto("/");

  await expect(page.locator(".dashboard-page")).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: "Mobile Suit Gundam Arsenal Base" })
      .first()
  ).toBeVisible();

  await page.goto("/media");
  await expect(
    page.getByRole("heading", { name: "Duel Masters" }).first()
  ).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: "Mobile Suit Gundam Arsenal Base" })
      .first()
  ).toBeVisible();

  await page.goto("/media/duel-masters-dm25/textbook/tcg-core-overview");
  await expect(
    page.getByRole("heading", { name: /TCG Core - Entrare nel gioco/ })
  ).toBeVisible();

  const rubyReading = page.locator("ruby rt").first();

  const furiganaControl = page.getByRole("group", {
    name: "Controllo furigana"
  });
  const hoverFuriganaButton = furiganaControl.getByRole("button", {
    name: "Al passaggio",
    exact: true
  });
  const alwaysFuriganaButton = furiganaControl.getByRole("button", {
    name: "Sempre",
    exact: true
  });

  if ((await hoverFuriganaButton.getAttribute("aria-pressed")) !== "true") {
    await hoverFuriganaButton.click();
  }

  await expect(rubyReading).toBeHidden();

  await alwaysFuriganaButton.click();
  await expect(rubyReading).toBeVisible();

  await hoverFuriganaButton.click();
  await expect(rubyReading).toBeHidden();

  await page.getByRole("button", { name: "クリーチャー" }).first().click();
  const entryTooltip = page.locator(".entry-tooltip-card");

  await expect(
    entryTooltip.getByRole("heading", { name: "クリーチャー" })
  ).toBeVisible();
  await expect(entryTooltip).not.toContainText("Livello:");
  await expect(entryTooltip).not.toContainText("Segmento:");
  const entryLink = entryTooltip.getByRole("link", { name: "Apri voce" });

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

  await page.goto("/glossary?media=duel-masters-dm25");
  const glossarySearch = page.getByRole("searchbox", { name: "Cerca" });
  await glossarySearch.fill("bochi");
  await glossarySearch.press("Enter");

  await expect(glossarySearch).toHaveValue("bochi");
  await expect(
    page.getByRole("heading", { name: "墓地" }).first()
  ).toBeVisible();
  await expect(page.getByText("cimitero / graveyard")).toBeVisible();
  await page.locator(".glossary-global-result__media-link").first().click();

  await expect(page).toHaveURL(
    /\/media\/duel-masters-dm25\/glossary\/term\/term-graveyard(?:\?|$)/
  );
  await expect(
    page
      .locator(".glossary-entry-hero__meaning")
      .getByText("cimitero / graveyard")
  ).toBeVisible();

  await ensureDuelMastersReviewAvailable(page);
  await page
    .getByRole("link", { name: "Vai alla review del capitolo" })
    .click();
  await expect(page).toHaveURL(/\/media\/duel-masters-dm25\/review\?segment=[^&]+$/);
  await expect(page.locator(".review-page")).toBeVisible();
  await expect(page.locator(".review-stage")).toBeVisible();

  const reviewNavigationStartedAt = performance.now();
  await page.goto("/review", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/review(?:\?|$)/);
  await expect(page.locator(".review-page")).toBeVisible();
  await expect(page.locator(".review-stage")).toBeVisible();
  await expect(page.locator(".review-stage__front")).toBeVisible();
  const initialReviewFront = await page
    .locator(".review-stage__front")
    .textContent();

  expect(initialReviewFront?.trim().length).toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Mostra risposta" })
  ).toBeVisible();
  console.info(
    `[review-e2e] first-stage-visible=${Math.round(
      performance.now() - reviewNavigationStartedAt
    )}ms`
  );

  await page.getByRole("button", { name: "Mostra risposta" }).click();
  const goodButton = page.getByRole("button", { name: /^Good/ });
  await goodButton.hover();
  await expect(goodButton).toHaveCSS("cursor", "pointer");
  await goodButton.click();

  await expect(page).toHaveURL(/\/review(?:\?|$)/);
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("button", { name: "Mostra risposta" })
  ).toBeVisible();
  await expect(page.locator(".review-stage__front")).not.toHaveText(
    initialReviewFront ?? ""
  );

  await page.goto("/media/duel-masters-dm25/progress");
  await expect(
    page.getByRole("heading", { name: "Duel Masters" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Apri review globale" })
  ).toBeVisible();
  await expect(page.getByText("Furigana")).toBeVisible();
  await expect(page.getByText("su richiesta")).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("radio", { name: /Ordine percorso/ }).check();
  await page.getByRole("button", { name: "Salva preferenze" }).click();

  await expect(page).toHaveURL(/saved=1/);
  await expect(page.getByRole("status")).toContainText("Preferenze salvate");

  await page.goto("/glossary?media=duel-masters-dm25");
  await expect(page.getByRole("combobox", { name: "Media" })).toHaveValue(
    "duel-masters-dm25"
  );
});

test("keeps the review session on a valid next state after grading again", async ({
  page
}) => {
  await ensureDuelMastersReviewAvailable(page);
  await page.goto("/review");
  await expect(page).toHaveURL(/\/review(?:\?|$)/);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".review-stage")).toBeVisible();

  await page.getByRole("button", { name: "Mostra risposta" }).click();
  await page.getByRole("button", { name: /^Again/ }).click();

  await expect(page).toHaveURL(/\/review(?:\?|$)/);
  await expect(page).not.toHaveURL(/show=answer/);
  await expect(page).not.toHaveURL(/card=/);

  const revealButton = page.getByRole("button", { name: "Mostra risposta" });
  await expect(revealButton).toBeVisible();
  await expect(page.getByRole("button", { name: /^Again/ })).toHaveCount(0);
});

test("updates the global review stage on same-route query-only navigation", async ({
  page
}) => {
  await ensureDuelMastersReviewAvailable(page);
  await page.goto("/review");
  await expect(page).toHaveURL(/\/review(?:\?|$)/);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".review-stage")).toBeVisible();

  const initialFront = (await page.locator(".review-stage__front").textContent())?.trim();
  expect(initialFront?.length).toBeGreaterThan(0);
  const targetCard =
    initialFront?.includes("墓地")
      ? {
          id: "card-effect-recognition",
          front: "効果"
        }
      : {
          id: "card-graveyard-recognition",
          front: "墓地"
        };

  await page.evaluate(() => {
    (window as Window & { __reviewClientNavMarker?: number }).__reviewClientNavMarker = 1;
  });

  await page.evaluate((cardId) => {
    const link = document.createElement("a");

    link.href = `/review?card=${cardId}`;
    link.textContent = "Vai alla card successiva";
    document.body.append(link);
  }, targetCard.id);

  await page.getByRole("link", { name: "Vai alla card successiva" }).click();

  await expect(page).toHaveURL(new RegExp(`/review\\?card=${targetCard.id}$`));
  await expect(page.locator(".review-stage__front")).toContainText(targetCard.front);
  await expect(page.getByRole("button", { name: "Mostra risposta" })).toBeVisible();

  const navigationMarker = await page.evaluate(() => {
    return (window as Window & { __reviewClientNavMarker?: number })
      .__reviewClientNavMarker;
  });

  expect(navigationMarker).toBe(1);
});

test("scrolls the review stage back into view after grading the next card", async ({
  page
}) => {
  await ensureDuelMastersReviewAvailable(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/review");
  await expect(page).toHaveURL(/\/review(?:\?|$)/);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".review-stage")).toBeVisible();

  await page.getByRole("button", { name: "Mostra risposta" }).click();

  await page.evaluate(() => {
    window.scrollTo({ top: document.body.scrollHeight });
  });

  const scrollBeforeGrade = await page.evaluate(() => window.scrollY);
  expect(scrollBeforeGrade).toBeGreaterThan(0);

  await page.getByRole("button", { name: /^Good/ }).click();

  await expect(
    page.getByRole("button", { name: "Mostra risposta" })
  ).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeLessThan(scrollBeforeGrade);

  const frontTop = await page
    .locator(".review-stage__front")
    .evaluate((element) => {
      return element.getBoundingClientRect().top;
    });

  expect(frontTop).toBeGreaterThanOrEqual(0);
  expect(frontTop).toBeLessThan(360);
});

test("keeps the revealed review answer mounted while the answer URL is synchronized", async ({
  page
}) => {
  await ensureDuelMastersReviewAvailable(page);
  await page.goto("/media/duel-masters-dm25/review");
  await expect(page).toHaveURL(/\/media\/duel-masters-dm25\/review(?:\?|$)/);

  await page.getByRole("button", { name: "Mostra risposta" }).click();
  await expect(page).toHaveURL(
    /\/media\/duel-masters-dm25\/review\?show=answer$/
  );

  await page.evaluate(() => {
    const answer = document.querySelector(".review-stage__answer");

    if (!answer) {
      throw new Error("Expected the review answer to be visible after reveal.");
    }

    answer.setAttribute("data-audit-id", "stable-answer");
  });

  await page.waitForTimeout(300);
  await expect(
    page.locator('.review-stage__answer[data-audit-id="stable-answer"]')
  ).toHaveCount(1);
});
