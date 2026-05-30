import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import {
  closeDatabaseClient,
  createDatabaseClient
} from "../../src/db/index.ts";
import {
  pitchAccentSession,
  pitchAccentTrial
} from "../../src/db/schema/index.ts";
import type { PitchAccentPairOption } from "../../src/features/pitch-accent/model/index.ts";
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

  const audioSrc = await page
    .locator("audio.pitch-accent-audio")
    .getAttribute("src");
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
  const continueButton = page.getByRole("button", { name: "Continua" });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
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

  await page.getByLabel("2 mora").uncheck();
  await page.getByLabel("Solo coppie con devoicing").check();
  await page.getByLabel("Coppie solo tra pattern selezionati").check();
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

    const filters = JSON.parse(session?.filtersJson ?? "{}") as {
      moraCounts?: number[];
      onlyDevoiced?: boolean;
      strictPairFinding?: boolean;
    };

    expect(filters).toMatchObject({
      onlyDevoiced: true,
      strictPairFinding: true
    });
    expect(filters.moraCounts).toBeTruthy();
    expect(filters.moraCounts).not.toContain(2);
  } finally {
    closeDatabaseClient(database);
  }
});

test("replays answer options after a wrong answer on mobile", async ({
  page
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await installMediaStubs(page);
  await page.goto("/pitch-accent");

  await page.getByRole("button", { name: "Avvia sessione" }).click();
  await expect(page).toHaveURL(/\/pitch-accent\/session\/[^/]+$/);

  const sessionId = new URL(page.url()).pathname.split("/").at(-1);
  expect(sessionId).toBeTruthy();
  const firstTrial = await readFirstPitchAccentTrial(sessionId!);
  const options = JSON.parse(
    firstTrial.optionsJson
  ) as readonly PitchAccentPairOption[];
  const wrongOption = options.find(
    (option) => option.id !== firstTrial.correctOptionId
  );
  const correctOption = options.find(
    (option) => option.id === firstTrial.correctOptionId
  );

  expect(wrongOption).toBeTruthy();
  expect(correctOption).toBeTruthy();

  const wrongOptionButton = optionButtonById(page, wrongOption!.id);
  const correctOptionButton = optionButtonById(page, correctOption!.id);
  const promptAudio = page.locator("audio.pitch-accent-audio");
  const promptAudioSrcBeforeReview = await promptAudio.getAttribute("src");

  await wrongOptionButton.click();
  await expect(page.getByRole("status")).toContainText("Da rifare");

  const playCountBeforeReview = await readPitchAccentPlayCount(page);
  await wrongOptionButton.click();

  await expect(promptAudio).toHaveAttribute("src", promptAudioSrcBeforeReview!);
  await expect
    .poll(() => readPitchAccentPlayCount(page))
    .toBeGreaterThan(playCountBeforeReview);

  const playCountBeforeSwitch = await readPitchAccentPlayCount(page);
  await correctOptionButton.click();
  await expect
    .poll(() => readPitchAccentPlayCount(page))
    .toBeGreaterThan(playCountBeforeSwitch);

  await expect(page.getByRole("button", { name: "Continua" })).toBeVisible();
  const continueIsInViewport = await page
    .getByRole("button", { name: "Continua" })
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();

      return rect.top < window.innerHeight && rect.bottom > 0;
    });
  expect(continueIsInViewport).toBe(true);

  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  expect(noHorizontalOverflow).toBe(true);

  const wrongOptionBox = await wrongOptionButton.boundingBox();
  expect(wrongOptionBox?.height).toBeGreaterThanOrEqual(44);
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

async function readFirstPitchAccentTrial(sessionId: string) {
  const database = createDatabaseClient({
    databaseUrl: process.env.E2E_DATABASE_URL
  });

  try {
    const trials = await database
      .select()
      .from(pitchAccentTrial)
      .where(eq(pitchAccentTrial.sessionId, sessionId));
    const firstTrial = trials.sort(
      (left, right) => left.sortOrder - right.sortOrder
    )[0];

    if (!firstTrial) {
      throw new Error(`No Pitch Accent trial found for ${sessionId}.`);
    }

    return firstTrial;
  } finally {
    closeDatabaseClient(database);
  }
}

function optionButtonById(page: Page, optionId: string) {
  return page.locator(
    `[data-testid="${testIds.pitchAccentOption}"][data-option-id="${optionId}"]`
  );
}

async function readPitchAccentPlayCount(page: Page) {
  return page.evaluate(
    () =>
      (window as Window & { __pitchAccentPlayCount?: number })
        .__pitchAccentPlayCount ?? 0
  );
}
