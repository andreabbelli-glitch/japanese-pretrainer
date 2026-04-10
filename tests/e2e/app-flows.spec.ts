import { createHash } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { prepareDuelMastersReviewBaseline } from "@/lib/e2e/review-baseline";

function buildDeterministicId(
  namespace: string,
  ...parts: Array<string | number | null | undefined>
) {
  const hash = createHash("sha256")
    .update(parts.map((part) => String(part ?? "")).join("\u001f"))
    .digest("hex")
    .slice(0, 20);

  return `${namespace}_${hash}`;
}

async function readReviewPageSignature(page: Page) {
  const stageChips = page.locator(".review-stage__chips");

  if ((await stageChips.count()) > 0) {
    return {
      kind: "stage" as const,
      value: [
        ((await stageChips.textContent()) ?? "").trim(),
        ((await page.locator(".review-stage__front").textContent()) ?? "").trim()
      ].join(" | ")
    };
  }

  return {
    kind: "empty" as const,
    value: (((await page.locator(".empty-state").textContent()) ?? "").trim())
  };
}

test("navigates the core study spine", async ({ page }) => {
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

  await page.goto("/media/duel-masters-dm25");
  await expect(page.locator(".media-detail-page")).toBeVisible();
  await expect(page.locator(".entry-point-grid")).toContainText("Textbook");
  await expect(page.locator(".entry-point-grid")).toContainText("Glossary");
  await expect(page.locator(".entry-point-grid")).toContainText("Review");

  await page
    .locator(".entry-point-card", { hasText: "Textbook" })
    .getByRole("link")
    .first()
    .click();

  await expect(page).toHaveURL("/media/duel-masters-dm25/textbook");
  await expect(
    page.getByRole("heading", { name: /TCG Core - Entrare nel gioco/ })
  ).toBeVisible();

  await page.goto("/media/duel-masters-dm25");
  await page
    .locator(".entry-point-link", { hasText: "Glossary" })
    .click();

  await expect(page).toHaveURL("/glossary?media=duel-masters-dm25");
  await expect(page.getByRole("combobox", { name: "Media" })).toHaveValue(
    "duel-masters-dm25"
  );
  await expect(page.locator(".glossary-results--portal")).toBeVisible();

  await page.goto("/media/duel-masters-dm25");
  await page
    .locator(".entry-point-link", { hasText: "Review del media" })
    .click();

  await expect(page).toHaveURL(
    /\/media\/duel-masters-dm25\/review(?:\?|$)/
  );
  await expect(page.locator(".review-page")).toBeVisible();

  await page.goto("/media/duel-masters-dm25/progress");
  await expect(page).toHaveURL(/\/media\/duel-masters-dm25(?:#overview)?$/);
  await expect(page.locator(".media-detail-page")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Apri review globale" })
  ).toBeVisible();

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

test.describe("review flows", () => {
  test.beforeEach(async () => {
    await prepareDuelMastersReviewBaseline();
  });

  test("keeps the review session on a valid next state after grading again", async ({
    page
  }) => {
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

  test("updates the global review stage when reopening /review with a different segment query", async ({
    page
  }) => {
    const firstTargetSegmentId = buildDeterministicId(
      "segment",
      "media-duel-masters-dm25",
      "tcg-core"
    );
    const secondTargetSegmentId = buildDeterministicId(
      "segment",
      "media-duel-masters-dm25",
      "duel-plays-app"
    );

    expect(firstTargetSegmentId).not.toBe(secondTargetSegmentId);
    await page.goto(`/review?segment=${firstTargetSegmentId}`);
    await page.waitForLoadState("networkidle");
    const expectedFirstState = await readReviewPageSignature(page);

    await page.goto(`/review?segment=${secondTargetSegmentId}`);
    await expect(page).toHaveURL(
      new RegExp(`/review\\?segment=${secondTargetSegmentId}$`)
    );
    await page.waitForLoadState("networkidle");
    const expectedSecondState = await readReviewPageSignature(page);

    expect(expectedFirstState).not.toEqual(expectedSecondState);

    await page.goto(`/review?segment=${firstTargetSegmentId}`);
    await expect(page).toHaveURL(
      new RegExp(`/review\\?segment=${firstTargetSegmentId}$`)
    );
    await page.waitForLoadState("networkidle");
    await expect(await readReviewPageSignature(page)).toEqual(expectedFirstState);
  });

  test("scrolls the review stage back into view after grading the next card", async ({
    page
  }) => {
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
});
