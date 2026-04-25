import { expect, test, type Locator, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import {
  kanjiClashManualContrast,
  kanjiClashManualContrastRoundState
} from "@/db/schema";
import { loadKanjiClashQueueSnapshot } from "@/lib/kanji-clash";

import { resolveStartE2EDatabaseUrl } from "../../scripts/start-e2e-config.ts";

const fixtureRoute =
  "/kanji-clash?media=zz-kanji-clash-e2e&mode=manual&size=10";
type KanjiClashSettingsPreset = {
  defaultScope: "global" | "media";
  manualDefaultSize: number;
};

const defaultKanjiClashSettings: KanjiClashSettingsPreset = {
  defaultScope: "global" as const,
  manualDefaultSize: 20
};

test.describe("with Kanji Clash settings overrides", () => {
  test.afterEach(async ({ page }) => {
    if (page.isClosed()) {
      return;
    }

    await restoreKanjiClashSettings(page);
  });

  test("smokes automatic mode and invalid manual size fallback from persisted settings", async ({
    page
  }) => {
    await applyKanjiClashSettings(page, {
      defaultScope: "media",
      manualDefaultSize: 40
    });

    await page.goto("/kanji-clash?mode=manual&size=999");

    await expect(
      page.getByRole("heading", { name: "Workspace di confronto" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Drill", exact: true })
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "40" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(page.getByText("Sessione finita con taglia 40")).toBeVisible();

    await Promise.all([
      page.waitForURL(
        (url) =>
          url.pathname === "/kanji-clash" &&
          url.searchParams.get("mode") === "automatic" &&
          !url.searchParams.has("media") &&
          !url.searchParams.has("size")
      ),
      page.getByRole("link", { name: "FSRS", exact: true }).click()
    ]);

    await expect(
      page.getByRole("link", { name: "FSRS", exact: true })
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByText(
        "Le nuove coppie restano separate dalla review standard e contano solo nel workspace Kanji Clash."
      )
    ).toBeVisible();

    await Promise.all([
      page.waitForURL(
        (url) =>
          url.pathname === "/kanji-clash" &&
          url.searchParams.get("mode") === "manual" &&
          url.searchParams.get("size") === "40" &&
          !url.searchParams.has("media")
      ),
      page.getByRole("link", { name: "Drill", exact: true }).click()
    ]);

    await expect(
      page.getByRole("link", { name: "Drill", exact: true })
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "40" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("switches Kanji Clash mode from the UI while preserving media context and normalized size", async ({
    page
  }) => {
    await applyKanjiClashSettings(page, {
      defaultScope: "media",
      manualDefaultSize: 40
    });

    await page.goto(
      "/kanji-clash?media=zz-kanji-clash-e2e&mode=manual&size=999"
    );

    await expect(
      page.getByRole("heading", { name: "Workspace di confronto" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "ZZ Kanji Clash E2E" })
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("link", { name: "Drill", exact: true })
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "40" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(page.getByText("Sessione finita con taglia 40")).toBeVisible();

    await Promise.all([
      page.waitForURL(
        (url) =>
          url.pathname === "/kanji-clash" &&
          url.searchParams.get("media") === "zz-kanji-clash-e2e" &&
          url.searchParams.get("mode") === "automatic" &&
          !url.searchParams.has("size")
      ),
      page.getByRole("link", { name: "FSRS", exact: true }).click()
    ]);

    await expect(
      page.getByRole("link", { name: "ZZ Kanji Clash E2E" })
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("link", { name: "FSRS", exact: true })
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByText(
        "Le nuove coppie restano separate dalla review standard e contano solo nel workspace Kanji Clash."
      )
    ).toBeVisible();

    await Promise.all([
      page.waitForURL(
        (url) =>
          url.pathname === "/kanji-clash" &&
          url.searchParams.get("media") === "zz-kanji-clash-e2e" &&
          url.searchParams.get("mode") === "manual" &&
          url.searchParams.get("size") === "40"
      ),
      page.getByRole("link", { name: "Drill", exact: true }).click()
    ]);

    await expect(
      page.getByRole("link", { name: "ZZ Kanji Clash E2E" })
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("link", { name: "Drill", exact: true })
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "40" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});

test("opens Kanji Clash from global review and leaves review counts unchanged", async ({
  page
}) => {
  await page.goto("/review");

  const reviewSidebar = page.locator(".review-sidebar");
  const baselineCounts = await readStatBlockValuesWithin(reviewSidebar, [
    "In coda",
    "Da ripassare",
    "Nuove"
  ]);
  const kanjiClashCta = reviewSidebar.getByRole("link", {
    name: "Apri Kanji Clash"
  });

  await expect(kanjiClashCta).toHaveAttribute("href", "/kanji-clash");
  await Promise.all([
    page.waitForURL(
      (url) =>
        url.pathname === "/kanji-clash" &&
        !url.searchParams.has("media") &&
        !url.searchParams.has("mode") &&
        !url.searchParams.has("size")
    ),
    kanjiClashCta.click()
  ]);

  await expect(
    page.getByRole("heading", { name: "Workspace di confronto" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Globale", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByText(
      "Le nuove coppie restano separate dalla review standard e contano solo nel workspace Kanji Clash."
    )
  ).toBeVisible();

  await Promise.all([
    page.waitForURL(
      (url) =>
        url.pathname === "/kanji-clash" &&
        url.searchParams.get("mode") === "manual" &&
        url.searchParams.get("size") === "20" &&
        !url.searchParams.has("media")
    ),
    page.getByRole("link", { name: "Drill", exact: true }).click()
  ]);

  const firstRound = await readCurrentRound(page);
  await answerRoundWithClick(page, firstRound.correctSide);
  await expect(
    page.locator(".kanji-clash-feedback[role='status']")
  ).toHaveCount(0);
  await waitForNextRound(page, firstRound);

  await page.goto("/review");

  await expect(page.locator(".review-page")).toBeVisible();
  await expect(
    reviewSidebar.getByRole("link", { name: "Apri Kanji Clash" })
  ).toBeVisible();
  await expect(
    await readStatBlockValuesWithin(reviewSidebar, [
      "In coda",
      "Da ripassare",
      "Nuove"
    ])
  ).toEqual(baselineCounts);
});

test("opens Kanji Clash from media detail and leaves local review counts unchanged", async ({
  page
}) => {
  await page.goto("/media/zz-kanji-clash-e2e");

  const reviewOverview = page.locator("#review-overview");
  const baselineCounts = await readStatBlockValuesWithin(reviewOverview, [
    "In coda",
    "Da ripassare",
    "Nuove oggi"
  ]);
  const kanjiClashEntryPoint = page.locator(
    '.entry-point-link[href="/kanji-clash?media=zz-kanji-clash-e2e"]'
  );

  await expect(kanjiClashEntryPoint).toContainText("Kanji Clash");
  await kanjiClashEntryPoint.click();
  await page.waitForURL(
    (url) =>
      url.pathname === "/kanji-clash" &&
      url.searchParams.get("media") === "zz-kanji-clash-e2e" &&
      !url.searchParams.has("mode") &&
      !url.searchParams.has("size")
  );

  await expect(
    page.getByRole("heading", { name: "Workspace di confronto" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ZZ Kanji Clash E2E" })
  ).toHaveAttribute("aria-current", "page");

  await Promise.all([
    page.waitForURL(
      (url) =>
        url.pathname === "/kanji-clash" &&
        url.searchParams.get("media") === "zz-kanji-clash-e2e" &&
        url.searchParams.get("mode") === "manual" &&
        url.searchParams.get("size") === "20"
    ),
    page.getByRole("link", { name: "Drill", exact: true }).click()
  ]);

  const firstRound = await readCurrentRound(page);
  await answerRoundWithClick(page, firstRound.correctSide);
  await expect(
    page.locator(".kanji-clash-feedback[role='status']")
  ).toHaveCount(0);
  await waitForNextRound(page, firstRound);

  await page.goto("/media/zz-kanji-clash-e2e");

  await expect(
    page.getByRole("heading", { name: "ZZ Kanji Clash E2E" })
  ).toBeVisible();
  await expect(
    await readStatBlockValuesWithin(reviewOverview, [
      "In coda",
      "Da ripassare",
      "Nuove oggi"
    ])
  ).toEqual(baselineCounts);
});

test("asserts visible Kanji Clash reveal state on wrong answers", async ({
  page
}) => {
  await page.goto("/kanji-clash?media=zz-kanji-clash-e2e&mode=manual&size=10");

  await expect(
    page.getByRole("heading", { name: "Workspace di confronto" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ZZ Kanji Clash E2E" })
  ).toHaveAttribute("aria-current", "page");

  const currentRound = await readCurrentRound(page);
  const currentVisibleRound = await readVisibleRound(page);

  expect(currentVisibleRound.left).not.toBe("");
  expect(currentVisibleRound.right).not.toBe("");
  expect(currentVisibleRound.left).not.toBe(currentVisibleRound.right);
  expect(currentVisibleRound.reading).not.toBe("");
  expect(currentVisibleRound.meaning).not.toBe("");
  await expect(page.locator(".kanji-clash-target__note")).toHaveCount(0);
  await expect(page.locator(".kanji-clash-option--left")).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  await expect(page.locator(".kanji-clash-option--right")).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  await expect(page.locator(".kanji-clash-option--left")).toBeEnabled();
  await expect(page.locator(".kanji-clash-option--right")).toBeEnabled();

  await answerRoundWithClick(page, currentRound.wrongSide);

  const wrongAnswerAlert = page.locator(".kanji-clash-feedback[role='alert']");
  await expect(wrongAnswerAlert).toContainText("Risposta errata");
  await expect(wrongAnswerAlert).toContainText(
    currentVisibleRound[currentRound.wrongSide]
  );
  await expect(wrongAnswerAlert).toContainText(
    currentVisibleRound[currentRound.correctSide]
  );
  await expect(
    page.locator(`.kanji-clash-option--${currentRound.wrongSide}`)
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(`.kanji-clash-option--${currentRound.wrongSide}`)
  ).toContainText("Scelta");
  await expect(
    page.locator(`.kanji-clash-option--${currentRound.correctSide}`)
  ).toContainText("Corretto");
  await expect(page.locator(".kanji-clash-target__note")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continua" })).toBeVisible();
  await expect(page.locator(".kanji-clash-stage__title")).toHaveText(
    currentVisibleRound.title
  );
  await expect(page.locator(".kanji-clash-target__reading")).toHaveText(
    currentVisibleRound.reading
  );
  await expect(page.locator(".kanji-clash-target__meaning")).toHaveText(
    currentVisibleRound.meaning
  );
  await expect(readStatBlockValue(page, "Rimanenti")).resolves.toBe(
    currentVisibleRound.remaining
  );
});

test("advances a correct round without feedback panel or viewport jump", async ({
  page
}) => {
  await page.goto(fixtureRoute);
  await page.evaluate(() => {
    window.scrollTo(0, 260);
  });

  const initialScrollY = await page.evaluate(() => window.scrollY);
  const currentRound = await readCurrentRound(page);

  await answerRoundWithClick(page, currentRound.correctSide);
  await expect(
    page.locator(".kanji-clash-feedback[role='status']")
  ).toHaveCount(0);
  await waitForNextRound(page, currentRound);

  const finalScrollY = await page.evaluate(() => window.scrollY);

  expect(Math.abs(finalScrollY - initialScrollY)).toBeLessThanOrEqual(2);
});

test("supports keyboard arrow interaction for the current round", async ({
  page
}) => {
  await page.goto(fixtureRoute);

  const currentRound = await readCurrentRound(page);

  await page.keyboard.press(
    currentRound.correctSide === "left" ? "ArrowLeft" : "ArrowRight"
  );
  await expect(
    page.locator(".kanji-clash-feedback[role='status']")
  ).toHaveCount(0);
  await waitForNextRound(page, currentRound);
});

test("offers a +10 top-up after completing a manual Kanji Clash session", async ({
  page
}) => {
  await page.goto(fixtureRoute);

  await finishManualSession(page, 12);

  await expect(
    page.getByRole("heading", { name: "Sessione completata" })
  ).toBeVisible();

  const topUpLink = page.getByRole("link", {
    name: "Aggiungi altri 10 round"
  });

  await expect(topUpLink).toHaveAttribute(
    "href",
    "/kanji-clash?mode=manual&media=zz-kanji-clash-e2e&size=20"
  );
  await topUpLink.click();
  await page.waitForURL(
    (url) =>
      url.pathname === "/kanji-clash" &&
      url.searchParams.get("media") === "zz-kanji-clash-e2e" &&
      url.searchParams.get("mode") === "manual" &&
      url.searchParams.get("size") === "20"
  );
  await expect(page.getByRole("link", { name: "20" })).toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("filters Kanji Clash by media and exposes a playable manual round", async ({
  page
}) => {
  await page.goto("/kanji-clash?mode=manual&size=10");

  await expect(
    page.locator('.site-nav__link[href="/kanji-clash"]')
  ).toBeVisible();
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

  const currentRound = await readCurrentRound(page);
  const currentVisibleRound = await readVisibleRound(page);

  expect(currentRound.pairKey).not.toBe("");
  expect(currentVisibleRound.left).not.toBe("");
  expect(currentVisibleRound.right).not.toBe("");
  expect(currentVisibleRound.left).not.toBe(currentVisibleRound.right);
  expect(currentVisibleRound.reading).not.toBe("");
  expect(currentVisibleRound.meaning).not.toBe("");
  await expect(page.locator(".kanji-clash-target__note")).toHaveCount(0);
  await expect(page.locator(".kanji-clash-option--left")).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  await expect(page.locator(".kanji-clash-option--right")).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  await expect(page.locator(".kanji-clash-option--left")).toBeEnabled();
  await expect(page.locator(".kanji-clash-option--right")).toBeEnabled();
});

test("keeps Kanji Clash progress when archiving and restoring a manual contrast", async ({
  page
}) => {
  const database = createKanjiClashE2EDatabaseClient();
  const now = new Date().toISOString();
  const queue = await loadKanjiClashQueueSnapshot({
    database,
    mediaIds: ["media-kanji-clash-e2e"],
    mode: "manual",
    now: new Date(now),
    requestedSize: 10,
    scope: "global"
  });
  const contrastRound = queue.rounds[4] ?? queue.rounds[2];

  if (!contrastRound) {
    closeDatabaseClient(database);
    throw new Error(
      "Expected a Kanji Clash round to seed the archive fixture."
    );
  }

  await insertKanjiClashManualContrast(database, contrastRound, now);

  try {
    await page.goto(fixtureRoute);

    await expect(
      page.getByRole("heading", { name: "Workspace di confronto" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Archivia", exact: true })
    ).toBeVisible();

    const initialNavigationCount = await getNavigationEntryCount(page);
    const firstRound = await readCurrentRound(page);

    await answerRoundWithClick(page, firstRound.correctSide);
    await waitForNextRound(page, firstRound);

    const roundAfterAnswer = await readCurrentRound(page);
    const archivedContrastButton = page.getByRole("button", {
      name: "Archivia",
      exact: true
    });

    await archivedContrastButton.click();
    await expect(
      page.getByRole("button", { name: "Ripristina", exact: true })
    ).toBeVisible();
    await expect(page.getByText("Contrasti archiviati")).toBeVisible();
    await expect(await getNavigationEntryCount(page)).toBe(
      initialNavigationCount
    );
    await expect(await readCurrentRound(page)).toEqual(roundAfterAnswer);

    await page.getByRole("button", { name: "Ripristina", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Archivia", exact: true })
    ).toBeVisible();
    await expect(await getNavigationEntryCount(page)).toBe(
      initialNavigationCount
    );
    await expect(await readCurrentRound(page)).toEqual(roundAfterAnswer);
  } finally {
    await deleteKanjiClashManualContrast(database, contrastRound.pairKey);
    closeDatabaseClient(database);
  }
});

test.describe("Kanji Clash mobile tap-only coverage", () => {
  test.use({
    hasTouch: true,
    viewport: {
      height: 844,
      width: 390
    }
  });

  test("supports real tap-only interaction on mobile", async ({ page }) => {
    await page.goto(fixtureRoute);

    const currentRound = await readCurrentRound(page);

    await answerRoundWithTap(page, currentRound.correctSide);
    await expect(
      page.locator(".kanji-clash-feedback[role='status']")
    ).toHaveCount(0);
    await waitForNextRound(page, currentRound);
  });
});

type KanjiClashRoundSnapshot = {
  correctSide: "left" | "right";
  pairKey: string;
  signature: `${string}::${string}`;
  targetSubjectKey: string;
  wrongSide: "left" | "right";
};

type KanjiClashRoundState =
  | { kind: "done" }
  | { kind: "round"; signature: `${string}::${string}` }
  | { kind: "transition"; state: "missing" | "unknown" };

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
    signature: `${pairKey}::${targetSubjectKey}`,
    targetSubjectKey,
    wrongSide: correctSide === "left" ? "right" : "left"
  } as const satisfies KanjiClashRoundSnapshot;
}

async function waitForNextRound(
  page: Page,
  previousRound: KanjiClashRoundSnapshot
) {
  const nextState = await waitForNextRoundOrCompletion(page, previousRound);

  if (nextState === "done") {
    throw new Error(
      "Expected another Kanji Clash round, but the session ended."
    );
  }

  return nextState;
}

async function waitForNextRoundOrCompletion(
  page: Page,
  previousRound: KanjiClashRoundSnapshot
) {
  const timeoutAt = Date.now() + 5_000;
  let lastState: KanjiClashRoundState = {
    kind: "transition",
    state: "unknown"
  };

  while (Date.now() < timeoutAt) {
    lastState = await getRoundState(page);

    if (lastState.kind === "done") {
      return "done";
    }

    if (
      lastState.kind === "round" &&
      lastState.signature !== previousRound.signature
    ) {
      return readCurrentRound(page);
    }

    await page.waitForTimeout(100);
  }

  throw new Error(
    `Timed out waiting for Kanji Clash to advance from ${previousRound.signature}. Last observed state: ${describeRoundState(
      lastState
    )}.`
  );
}

async function finishManualSession(page: Page, maxRounds: number) {
  for (let index = 0; index < maxRounds; index += 1) {
    const currentRound = await readCurrentRound(page);

    await answerRoundWithClick(page, currentRound.correctSide);

    const nextState = await waitForNextRoundOrCompletion(page, currentRound);

    if (nextState === "done") {
      return;
    }
  }

  throw new Error(
    "Manual Kanji Clash session did not complete within the expected rounds."
  );
}

async function getRoundState(page: Page) {
  const stage = page.locator(".kanji-clash-stage");

  if (await stage.isVisible().catch(() => false)) {
    const pairKey = await stage.getAttribute("data-pair-key");
    const targetSubjectKey = await stage.getAttribute(
      "data-target-subject-key"
    );

    if (pairKey && targetSubjectKey) {
      return {
        kind: "round",
        signature: `${pairKey}::${targetSubjectKey}`
      } as const satisfies KanjiClashRoundState;
    }

    return {
      kind: "transition",
      state: "missing"
    } as const satisfies KanjiClashRoundState;
  }

  if (
    await page
      .locator(".empty-state")
      .isVisible()
      .catch(() => false)
  ) {
    return { kind: "done" } as const satisfies KanjiClashRoundState;
  }

  return {
    kind: "transition",
    state: "unknown"
  } as const satisfies KanjiClashRoundState;
}

function describeRoundState(state: KanjiClashRoundState) {
  if (state.kind === "round") {
    return state.signature;
  }

  if (state.kind === "transition") {
    return state.state;
  }

  return state.kind;
}

async function answerRoundWithClick(page: Page, side: "left" | "right") {
  await page.locator(`.kanji-clash-option--${side}`).click();
}

async function answerRoundWithTap(page: Page, side: "left" | "right") {
  await page.locator(`.kanji-clash-option--${side}`).tap();
}

async function readVisibleRound(page: Page) {
  return {
    left: (
      (await page
        .locator(".kanji-clash-option--left .kanji-clash-option__surface")
        .textContent()) ?? ""
    ).trim(),
    meaning: (
      (await page.locator(".kanji-clash-target__meaning").textContent()) ?? ""
    ).trim(),
    reading: (
      (await page.locator(".kanji-clash-target__reading").textContent()) ?? ""
    ).trim(),
    remaining: await readStatBlockValue(page, "Rimanenti"),
    right: (
      (await page
        .locator(".kanji-clash-option--right .kanji-clash-option__surface")
        .textContent()) ?? ""
    ).trim(),
    title: (
      (await page.locator(".kanji-clash-stage__title").textContent()) ?? ""
    ).trim()
  } as const;
}

async function readStatBlockValue(page: Page, label: string) {
  return readStatBlockValueWithin(page.locator("body"), label);
}

async function readStatBlockValueWithin(root: Locator, label: string) {
  const statBlock = root.locator(".stat-block").filter({
    hasText: label
  });
  const value = await statBlock.locator(".stat-block__value").textContent();

  return Number.parseInt(value ?? "0", 10);
}

async function readStatBlockValuesWithin(root: Locator, labels: string[]) {
  return Object.fromEntries(
    await Promise.all(
      labels.map(async (label) => [
        label,
        await readStatBlockValueWithin(root, label)
      ])
    )
  );
}

async function applyKanjiClashSettings(
  page: Page,
  settings: KanjiClashSettingsPreset
) {
  const defaultScopeRadio = page.locator(
    `input[name="kanjiClashDefaultScope"][value="${settings.defaultScope}"]`
  );
  const manualSizeSelect = page.locator(
    'select[name="kanjiClashManualDefaultSize"]'
  );

  await page.goto("/settings");
  await defaultScopeRadio.check();
  await expect(defaultScopeRadio).toBeChecked();
  await manualSizeSelect.selectOption(String(settings.manualDefaultSize));
  await expect(manualSizeSelect).toHaveValue(
    String(settings.manualDefaultSize)
  );

  await page.getByRole("button", { name: "Salva preferenze" }).click();
  await expect(page).toHaveURL(/\/settings\?saved=1(?:&.*)?$/);
  await expect(page.getByRole("status")).toContainText("Preferenze salvate");
}

async function restoreKanjiClashSettings(page: Page) {
  await applyKanjiClashSettings(page, defaultKanjiClashSettings);
}

function createKanjiClashE2EDatabaseClient() {
  return createDatabaseClient({
    databaseUrl: resolveStartE2EDatabaseUrl(process.env)
  });
}

async function insertKanjiClashManualContrast(
  database: DatabaseClient,
  round: Awaited<
    ReturnType<typeof loadKanjiClashQueueSnapshot>
  >["rounds"][number],
  nowIso: string
) {
  await database.insert(kanjiClashManualContrast).values({
    contrastKey: round.pairKey,
    createdAt: nowIso,
    forcedDueAt: nowIso,
    lastForcedAt: nowIso,
    source: "forced",
    status: "active",
    subjectAKey: round.candidate.leftSubjectKey,
    subjectBKey: round.candidate.rightSubjectKey,
    timesConfirmed: 1,
    updatedAt: nowIso
  });
  await database.insert(kanjiClashManualContrastRoundState).values([
    {
      contrastKey: round.pairKey,
      createdAt: nowIso,
      difficulty: null,
      direction: "subject_a",
      dueAt: nowIso,
      lapses: 0,
      lastInteractionAt: nowIso,
      lastReviewedAt: null,
      learningSteps: 0,
      leftSubjectKey: round.candidate.leftSubjectKey,
      reps: 0,
      rightSubjectKey: round.candidate.rightSubjectKey,
      roundKey: `${round.pairKey}::subject_a`,
      scheduledDays: 0,
      stability: null,
      state: "new",
      targetSubjectKey: round.candidate.leftSubjectKey,
      updatedAt: nowIso
    },
    {
      contrastKey: round.pairKey,
      createdAt: nowIso,
      difficulty: null,
      direction: "subject_b",
      dueAt: nowIso,
      lapses: 0,
      lastInteractionAt: nowIso,
      lastReviewedAt: null,
      learningSteps: 0,
      leftSubjectKey: round.candidate.leftSubjectKey,
      reps: 0,
      rightSubjectKey: round.candidate.rightSubjectKey,
      roundKey: `${round.pairKey}::subject_b`,
      scheduledDays: 0,
      stability: null,
      state: "new",
      targetSubjectKey: round.candidate.rightSubjectKey,
      updatedAt: nowIso
    }
  ]);
}

async function deleteKanjiClashManualContrast(
  database: DatabaseClient,
  contrastKey: string
) {
  await database
    .delete(kanjiClashManualContrastRoundState)
    .where(eq(kanjiClashManualContrastRoundState.contrastKey, contrastKey));
  await database
    .delete(kanjiClashManualContrast)
    .where(eq(kanjiClashManualContrast.contrastKey, contrastKey));
}

async function getNavigationEntryCount(page: Page) {
  return page.evaluate(() => performance.getEntriesByType("navigation").length);
}
