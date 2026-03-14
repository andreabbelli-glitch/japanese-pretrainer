import { expect, test } from "@playwright/test";

test("redirects the legacy local glossary route to the filtered global glossary", async ({
  page
}) => {
  await page.goto(
    "/media/duel-masters-dm25/glossary?preview=term-creature&previewKind=term"
  );
  await expect(page).toHaveURL("/glossary?media=duel-masters-dm25");
  await expect(
    page.getByRole("heading", { name: "Glossary" }).first()
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Media" })).toHaveValue(
    "duel-masters-dm25"
  );
});
