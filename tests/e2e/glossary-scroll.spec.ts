import { expect, test } from "@playwright/test";

test("scrolls glossary results and preview independently on desktop", async ({
  page
}) => {
  await page.goto(
    "/media/duel-masters-dm25/glossary?preview=term-creature&previewKind=term"
  );

  const workspace = page.locator(".glossary-workspace");
  const results = page.locator(".glossary-workspace__results");
  const preview = page.locator(".glossary-preview-panel");

  await workspace.scrollIntoViewIfNeeded();
  await expect(results).toBeVisible();
  await expect(preview).toBeVisible();

  const [resultsScrollable, previewScrollable] = await Promise.all([
    results.evaluate((element) => element.scrollHeight > element.clientHeight),
    preview.evaluate((element) => element.scrollHeight > element.clientHeight)
  ]);

  expect(resultsScrollable).toBe(true);
  expect(previewScrollable).toBe(true);

  const previewBox = await preview.boundingBox();
  const resultsBox = await results.boundingBox();

  expect(previewBox).not.toBeNull();
  expect(resultsBox).not.toBeNull();

  const resultsBeforePreviewScroll = await results.evaluate(
    (element) => element.scrollTop
  );
  const previewBeforeScroll = await preview.evaluate(
    (element) => element.scrollTop
  );

  await page.mouse.move(
    previewBox!.x + previewBox!.width / 2,
    previewBox!.y + previewBox!.height / 2
  );
  await page.mouse.wheel(0, 900);

  await expect
    .poll(async () => preview.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(previewBeforeScroll);
  await expect
    .poll(async () => results.evaluate((element) => element.scrollTop))
    .toBe(resultsBeforePreviewScroll);

  const resultsBeforeScroll = await results.evaluate(
    (element) => element.scrollTop
  );
  const previewBeforeResultsScroll = await preview.evaluate(
    (element) => element.scrollTop
  );

  await page.mouse.move(
    resultsBox!.x + resultsBox!.width / 2,
    resultsBox!.y + resultsBox!.height / 2
  );
  await page.mouse.wheel(0, 900);

  await expect
    .poll(async () => results.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(resultsBeforeScroll);
  await expect
    .poll(async () => preview.evaluate((element) => element.scrollTop))
    .toBe(previewBeforeResultsScroll);
});
