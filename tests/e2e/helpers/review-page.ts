import { expect, type Locator, type Page } from "@playwright/test";

import { testIds } from "./selectors";

export function reviewReadyLocator(page: Page) {
  return page
    .getByTestId(testIds.reviewChips)
    .or(page.getByTestId(testIds.emptyState))
    .first();
}

export async function expectReviewReady(page: Page) {
  await expect(reviewReadyLocator(page)).toBeVisible();
}

export async function revealReviewAnswer(page: Page) {
  await page.getByRole("button", { name: "Mostra risposta" }).click();
  await expect(page.getByTestId(testIds.reviewAnswer)).toBeVisible();
}

export async function startElementConnectionStabilityWatch(
  locator: Locator,
  options: { stabilityMs?: number } = {}
) {
  const stabilityMs = options.stabilityMs ?? 250;
  const handle = await locator.elementHandle();
  expect(handle).not.toBeNull();

  const connectionResult = handle!.evaluate((element, durationMs) => {
    return new Promise<boolean>((resolve) => {
      if (!element.isConnected) {
        resolve(false);
        return;
      }

      let settled = false;
      let observer: MutationObserver | null = null;
      let timeout: number | null = null;

      const finish = (isConnected: boolean) => {
        if (settled) {
          return;
        }

        settled = true;
        observer?.disconnect();

        if (timeout !== null) {
          window.clearTimeout(timeout);
        }

        resolve(isConnected);
      };

      observer = new MutationObserver(() => {
        if (!element.isConnected) {
          finish(false);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      timeout = window.setTimeout(() => {
        finish(element.isConnected);
      }, durationMs);
    });
  }, stabilityMs);

  return async () => {
    try {
      await expect(connectionResult).resolves.toBe(true);
    } finally {
      await handle!.dispose();
    }
  };
}

export async function gradeReview(page: Page, gradeName: RegExp | string) {
  await page.getByRole("button", { name: gradeName }).click();
}

export function reviewFrontLocator(page: Page) {
  return page.getByTestId(testIds.reviewStage).getByRole("heading").first();
}

export async function readReviewPageSignature(page: Page) {
  const chips = page.getByTestId(testIds.reviewChips).first();

  if (await chips.isVisible().catch(() => false)) {
    return {
      kind: "stage" as const,
      value: [
        ((await chips.textContent()) ?? "").trim(),
        ((await reviewFrontLocator(page).textContent()) ?? "").trim()
      ].join(" | ")
    };
  }

  const emptyState = page.getByTestId(testIds.emptyState).first();
  await expect(emptyState).toBeVisible();

  return {
    kind: "empty" as const,
    value: ((await emptyState.textContent()) ?? "").trim()
  };
}
