import { expect, type Page } from "@playwright/test";

import {
  readStatBlockValue as readSharedStatBlockValue,
  readStatBlockValuesWithin,
  testIds
} from "./selectors";

export type KanjiClashRoundSnapshot = {
  correctSide: "left" | "right";
  pairKey: string;
  signature: `${string}::${string}`;
  targetSubjectKey: string;
  wrongSide: "left" | "right";
};

export type KanjiClashRoundState =
  | { kind: "done" }
  | { kind: "round"; signature: `${string}::${string}` }
  | { kind: "transition"; state: "missing" | "unknown" };

export async function readCurrentRound(page: Page) {
  const stage = page.getByTestId(testIds.kanjiClashStage);

  await expect(stage).toBeVisible();

  const pairKey = await stage.getAttribute("data-pair-key");
  const targetSubjectKey = await stage.getAttribute("data-target-subject-key");
  const leftSubjectKey = await page
    .getByTestId(testIds.kanjiClashOption("left"))
    .getAttribute("data-subject-key");
  const rightSubjectKey = await page
    .getByTestId(testIds.kanjiClashOption("right"))
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

export async function waitForNextRound(
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

export async function waitForNextRoundOrCompletion(
  page: Page,
  previousRound: KanjiClashRoundSnapshot
) {
  await expect
    .poll(
      async () => {
        const state = await getRoundState(page);

        if (state.kind === "done") {
          return "ready";
        }

        if (
          state.kind === "round" &&
          state.signature !== previousRound.signature
        ) {
          return "ready";
        }

        return "waiting";
      },
      {
        message: `Kanji Clash should advance from ${previousRound.signature}`,
        timeout: 5_000
      }
    )
    .toBe("ready");

  const state = await getRoundState(page);

  if (state.kind === "done") {
    return "done" as const;
  }

  if (state.kind === "round") {
    return readCurrentRound(page);
  }

  throw new Error(
    `Timed out waiting for Kanji Clash to advance from ${previousRound.signature}. Last observed state: ${describeRoundState(
      state
    )}.`
  );
}

export async function finishManualSession(page: Page, maxRounds: number) {
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

export async function answerRoundWithClick(page: Page, side: "left" | "right") {
  await page.getByTestId(testIds.kanjiClashOption(side)).click();
}

export async function answerRoundWithTap(page: Page, side: "left" | "right") {
  await page.getByTestId(testIds.kanjiClashOption(side)).tap();
}

export async function readVisibleRound(page: Page) {
  return {
    left: (
      (await page
        .getByTestId(testIds.kanjiClashOption("left"))
        .textContent()) ?? ""
    ).trim(),
    meaning: (
      (await page.getByTestId(testIds.kanjiClashTargetMeaning).textContent()) ??
      ""
    ).trim(),
    reading: (
      (await page.getByTestId(testIds.kanjiClashTargetReading).textContent()) ??
      ""
    ).trim(),
    remaining: await readStatBlockValue(page, "Rimanenti"),
    right: (
      (await page
        .getByTestId(testIds.kanjiClashOption("right"))
        .textContent()) ?? ""
    ).trim(),
    title: (
      (await page.getByTestId(testIds.kanjiClashRoundTitle).textContent()) ?? ""
    ).trim()
  } as const;
}

export const readStatBlockValue = readSharedStatBlockValue;
export { readStatBlockValuesWithin };

async function getRoundState(page: Page) {
  const stage = page.getByTestId(testIds.kanjiClashStage);

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
      .getByTestId(testIds.emptyState)
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
