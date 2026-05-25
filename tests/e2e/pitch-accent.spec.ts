import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import {
  closeDatabaseClient,
  createDatabaseClient
} from "../../src/db/index.ts";
import { pitchAccentSession } from "../../src/db/schema/index.ts";
import { testIds } from "./helpers/selectors";

test("starts a Pitch Accent session and persists a recap", async ({ page }) => {
  await installMediaStubs(page);
  await page.goto("/pitch-accent");

  await expect(page.getByRole("link", { name: /Pitch/ })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    page.getByRole("heading", { name: "Pitch Accent" }).first()
  ).toBeVisible();

  await page.getByRole("button", { name: "Avvia sessione" }).click();
  await expect(page).toHaveURL(/\/pitch-accent\/session\/[^/]+$/);
  await expect(page.getByTestId(testIds.pitchAccentStage)).toBeVisible();
  await expect(page.getByTestId(testIds.pitchAccentTop)).toContainText(
    "1 / 20"
  );

  const audioSrc = await page.locator("audio").getAttribute("src");
  expect(audioSrc).toBeTruthy();
  const audioResponse = await page.request.get(
    new URL(audioSrc!, page.url()).toString()
  );
  expect(audioResponse.status()).toBe(200);
  expect((await audioResponse.body()).length).toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __pitchAccentPlayCount?: number })
            .__pitchAccentPlayCount ?? 0
      )
    )
    .toBeGreaterThanOrEqual(1);

  await page.getByLabel("Pausa dopo corretto").check();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  const playCountAfterAutoplay = await page.evaluate(
    () =>
      (window as Window & { __pitchAccentPlayCount?: number })
        .__pitchAccentPlayCount ?? 0
  );
  await page.keyboard.press("r");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __pitchAccentPlayCount?: number })
            .__pitchAccentPlayCount ?? 0
      )
    )
    .toBeGreaterThan(playCountAfterAutoplay);

  await page.keyboard.press("1");
  await expect(page.getByRole("status")).toContainText(/Corretto|Da rifare/u);
  await page.keyboard.press("Space");
  await expect(page.getByTestId(testIds.pitchAccentTop)).toContainText(
    "2 / 20"
  );

  await page.getByRole("button", { name: "Abbandona e salva recap" }).click();

  await expect(page).toHaveURL(/\/pitch-accent\/recap\/[^/]+$/);
  await expect(page.getByTestId(testIds.pitchAccentRecap)).toBeVisible();
  await expect(page.getByTestId(testIds.pitchAccentAttemptRow)).toHaveCount(1);

  await page.reload();
  await expect(page.getByTestId(testIds.pitchAccentAttemptRow)).toHaveCount(1);
});

test("stores selected Pitch Accent filters when starting a session", async ({
  page
}) => {
  await installMediaStubs(page);
  await page.goto("/pitch-accent");

  await page.getByLabel("Solo devoicing").check();
  await page.getByLabel("Strict pair finding").check();
  await page.getByRole("button", { name: "Avvia sessione" }).click();
  await expect(page).toHaveURL(/\/pitch-accent\/session\/[^/]+$/);

  const sessionId = new URL(page.url()).pathname.split("/").at(-1);
  expect(sessionId).toBeTruthy();
  const database = createDatabaseClient({
    databaseUrl: process.env.E2E_DATABASE_URL
  });

  try {
    const session = await database.query.pitchAccentSession.findFirst({
      where: eq(pitchAccentSession.id, sessionId!)
    });

    expect(JSON.parse(session?.filtersJson ?? "{}")).toMatchObject({
      onlyDevoiced: true,
      strictPairFinding: true
    });
  } finally {
    closeDatabaseClient(database);
  }
});

async function installMediaStubs(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value() {
        const state = window as Window & { __pitchAccentPlayCount?: number };
        state.__pitchAccentPlayCount = (state.__pitchAccentPlayCount ?? 0) + 1;
        return Promise.resolve();
      }
    });
    Object.defineProperty(HTMLMediaElement.prototype, "load", {
      configurable: true,
      value() {}
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value() {}
    });
  });
}
