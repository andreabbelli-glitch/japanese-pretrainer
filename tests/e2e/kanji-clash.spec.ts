import { expect, test, type Page } from "@playwright/test";

const fixtureRoute = "/kanji-clash?media=zz-kanji-clash-e2e&mode=manual&size=10";

test("covers Kanji Clash filter, click, keyboard, stop-on-error, and pair dedupe", async ({
  page
}) => {
  await page.goto("/kanji-clash?mode=manual&size=10");

  await expect(page.locator('.site-nav__link[href="/kanji-clash"]')).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Workspace di confronto" })
  ).toBeVisible();

  const globalCount = await readStatBlockValue(page, "In coda");

  await page.getByRole("link", { name: "ZZ Kanji Clash E2E" }).click();

  await page.waitForURL(
    (url) =>
      url.pathname === "/kanji-clash" &&
      url.searchParams.get("media") === "zz-kanji-clash-e2e" &&
      url.searchParams.get("mode") === "manual" &&
      url.searchParams.get("size") === "10"
  );
  await expect(
    page.getByRole("link", { name: "ZZ Kanji Clash E2E" })
  ).toHaveAttribute("aria-current", "page");

  const filteredCount = await readStatBlockValue(page, "In coda");

  expect(filteredCount).toBeGreaterThan(0);
  expect(filteredCount).toBeLessThanOrEqual(globalCount);

  const seenPairKeys = new Set<string>();
  let currentRound = await readCurrentRound(page);

  seenPairKeys.add(currentRound.pairKey);
  await answerRoundWithClick(page, currentRound.correctSide);
  await expect(page.getByRole("status")).toContainText("Risposta corretta");

  const secondRound = await waitForNextRound(page, currentRound.pairKey);

  expect(seenPairKeys.has(secondRound.pairKey)).toBe(false);
  seenPairKeys.add(secondRound.pairKey);

  await answerRoundWithClick(page, secondRound.wrongSide);
  await expect(page.locator(".kanji-clash-feedback[role='alert']")).toContainText(
    "Risposta errata"
  );
  await page.waitForTimeout(500);
  await expect(page.locator(".kanji-clash-stage")).toHaveAttribute(
    "data-pair-key",
    secondRound.pairKey
  );

  await page.getByRole("button", { name: "Continua" }).click();

  currentRound = await waitForNextRound(page, secondRound.pairKey);
  expect(seenPairKeys.has(currentRound.pairKey)).toBe(false);
  seenPairKeys.add(currentRound.pairKey);

  await answerRoundWithKeyboard(page, currentRound.correctSide);
  await expect(page.getByRole("status")).toContainText("Risposta corretta");

  const nextStateAfterThirdRound = await waitForNextRoundOrCompletion(
    page,
    currentRound.pairKey
  );

  if (nextStateAfterThirdRound !== "done") {
    currentRound = nextStateAfterThirdRound;

    while (true) {
      expect(seenPairKeys.has(currentRound.pairKey)).toBe(false);
      seenPairKeys.add(currentRound.pairKey);

      await answerRoundWithKeyboard(page, currentRound.correctSide);
      await expect(page.getByRole("status")).toContainText("Risposta corretta");

      const nextState = await waitForNextRoundOrCompletion(
        page,
        currentRound.pairKey
      );

      if (nextState === "done") {
        break;
      }

      currentRound = nextState;
    }
  }

  await expect(page.locator(".empty-state")).toContainText("Sessione completata");
});

test.describe("Kanji Clash mobile gestures", () => {
  test.use({
    hasTouch: true,
    viewport: {
      height: 844,
      width: 390
    }
  });

  test("supports tap and swipe on mobile", async ({ page }) => {
    await page.goto(fixtureRoute);

    let currentRound = await readCurrentRound(page);

    await answerRoundWithTap(page, currentRound.correctSide);
    await expect(page.getByRole("status")).toContainText("Risposta corretta");

    currentRound = await waitForNextRound(page, currentRound.pairKey);

    await answerRoundWithSwipe(page, currentRound.correctSide);
    await expect(page.getByRole("status")).toContainText("Risposta corretta");
    await waitForNextRound(page, currentRound.pairKey);
  });
});

async function readCurrentRound(page: Page) {
  const stage = page.locator(".kanji-clash-stage");

  await expect(stage).toBeVisible();

  const pairKey = await stage.getAttribute("data-pair-key");
  const targetSubjectKey = await stage.getAttribute("data-target-subject-key");
  const leftSubjectKey = await page
    .locator(".kanji-clash-option--left")
    .getAttribute("data-subject-key");
  const rightSubjectKey = await page
    .locator(".kanji-clash-option--right")
    .getAttribute("data-subject-key");

  if (!pairKey || !targetSubjectKey || !leftSubjectKey || !rightSubjectKey) {
    throw new Error("Missing Kanji Clash round metadata for E2E verification.");
  }

  const correctSide = leftSubjectKey === targetSubjectKey ? "left" : "right";

  return {
    correctSide,
    pairKey,
    wrongSide: correctSide === "left" ? "right" : "left"
  } as const;
}

async function waitForNextRound(page: Page, previousPairKey: string) {
  const nextState = await waitForNextRoundOrCompletion(page, previousPairKey);

  if (nextState === "done") {
    throw new Error("Expected another Kanji Clash round, but the session ended.");
  }

  return nextState;
}

async function waitForNextRoundOrCompletion(page: Page, previousPairKey: string) {
  await expect
    .poll(async () => getRoundState(page), {
      timeout: 5_000
    })
    .not.toBe(previousPairKey);

  const state = await getRoundState(page);

  return state === "done" ? "done" : readCurrentRound(page);
}

async function getRoundState(page: Page) {
  const stage = page.locator(".kanji-clash-stage");

  if (await stage.isVisible().catch(() => false)) {
    return (await stage.getAttribute("data-pair-key")) ?? "missing";
  }

  if (await page.locator(".empty-state").isVisible().catch(() => false)) {
    return "done";
  }

  return "unknown";
}

async function answerRoundWithClick(page: Page, side: "left" | "right") {
  await page.locator(`.kanji-clash-option--${side}`).click();
}

async function answerRoundWithTap(page: Page, side: "left" | "right") {
  await page.locator(`.kanji-clash-option--${side}`).tap();
}

async function answerRoundWithKeyboard(page: Page, side: "left" | "right") {
  await page.keyboard.press(side === "left" ? "ArrowLeft" : "ArrowRight");
}

async function answerRoundWithSwipe(page: Page, side: "left" | "right") {
  await page.locator(".kanji-clash-stage").evaluate((element, resolvedSide) => {
    const createTouchEvent = (
      type: "touchstart" | "touchend",
      deltaX: number
    ) => {
      const event = new Event(type, {
        bubbles: true,
        cancelable: true
      });
      const startX = 180;
      const endX = startX + deltaX;
      const touchList = [{ clientX: endX, clientY: 220 }];

      Object.defineProperty(event, "touches", {
        value: type === "touchstart" ? touchList : [],
        writable: false
      });
      Object.defineProperty(event, "changedTouches", {
        value: touchList,
        writable: false
      });

      return event;
    };

    element.dispatchEvent(
      createTouchEvent("touchstart", 0)
    );
    element.dispatchEvent(
      createTouchEvent("touchend", resolvedSide === "left" ? -96 : 96)
    );
  }, side);
}

async function readStatBlockValue(page: Page, label: string) {
  const statBlock = page.locator(".stat-block").filter({
    has: page.locator(".stat-block__label", {
      hasText: label
    })
  });
  const value = await statBlock.locator(".stat-block__value").textContent();

  return Number.parseInt(value ?? "0", 10);
}
