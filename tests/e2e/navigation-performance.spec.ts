import { expect, test, type Request } from "@playwright/test";

function destination(request: Request) {
  const url = new URL(request.url());
  url.searchParams.delete("_rsc");
  return `${url.pathname}${url.search}`;
}

for (const surface of ["library", "kanji"] as const) {
  test(`preloads only the chosen ${surface} destination on keyboard focus`, async ({
    page
  }) => {
    const requests: Request[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).searchParams.has("_rsc")) {
        requests.push(request);
      }
    });
    await page.goto(
      surface === "library" ? "/media" : "/kanji-clash?mode=automatic"
    );
    const chosen =
      surface === "library"
        ? page.getByRole("link", { name: "Apri media", exact: true }).first()
        : page.getByRole("link", { name: "Drill", exact: true });
    await expect(chosen).toBeVisible();
    const destinations = await page
      .locator("main a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));

    // Observe idle viewport prefetching after hydration, before any intent.
    await page.waitForTimeout(700);
    expect(
      requests.map(destination).filter((href) => destinations.includes(href))
    ).toEqual([]);

    const href = await chosen.getAttribute("href");
    const preloaded = page.waitForResponse(
      (response) =>
        response.request().headers()["next-router-prefetch"] === "1" &&
        destination(response.request()) === href
    );
    await chosen.focus();
    expect((await preloaded).ok()).toBe(true);
    expect(
      new Set(
        requests.map(destination).filter((url) => destinations.includes(url))
      )
    ).toEqual(new Set([href]));

    await chosen.press("Enter");
    await expect(page).toHaveURL(href!);
    if (surface === "library") {
      await expect(page.getByTestId("media-detail-page")).toBeVisible();
    } else {
      await expect(
        page.getByRole("link", { name: "Drill", exact: true })
      ).toHaveAttribute("aria-current", "page");
    }
  });
}

for (const section of ["textbook", "glossary"] as const) {
  test(`opens ${section} while its intent prefetch is still in flight`, async ({
    page
  }) => {
    const href =
      section === "textbook"
        ? "/media/duel-masters-dm25/textbook"
        : "/glossary?media=duel-masters-dm25";
    let release = () => {};
    const heldResponse = new Promise<void>((resolve) => {
      release = resolve;
    });
    let heldRequests = 0;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*_rsc=*", async (route) => {
      if (
        destination(route.request()) === href &&
        route.request().headers()["next-router-prefetch"] === "1"
      ) {
        heldRequests++;
        await heldResponse;
      }
      await route.continue();
    });

    await page.goto("/media/duel-masters-dm25");
    const grid = page.getByTestId("entry-point-grid");
    const chosen =
      section === "textbook"
        ? grid.getByRole("link", { name: "Apri", exact: true })
        : grid.getByRole("link").filter({ hasText: "Glossary" });
    try {
      await chosen.hover();
      await expect.poll(() => heldRequests).toBeGreaterThan(0);
      const navigations: Request[] = [];
      page.on("request", (request) => {
        if (request.isNavigationRequest()) navigations.push(request);
      });
      setTimeout(release, 250);
      await chosen.click();
      await expect(page).toHaveURL(href);
      if (section === "textbook") {
        await expect(
          page.getByRole("heading", {
            name: /Entrare nel gioco: zone, attori e testo della carta/
          })
        ).toBeVisible();
      } else {
        await expect(page.getByRole("combobox", { name: "Media" })).toHaveValue(
          "duel-masters-dm25"
        );
        await expect(page.getByTestId("glossary-portal-results")).toBeVisible();
      }
      expect(navigations).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      release();
    }
  });
}
