import { expect, test } from "@playwright/test";

test("returns not found for the legacy local glossary route", async ({
  page
}) => {
  await page.goto(
    "/media/duel-masters-dm25/glossary?preview=term-creature&previewKind=term"
  );
  await expect(page).toHaveURL(
    "/media/duel-masters-dm25/glossary?preview=term-creature&previewKind=term"
  );
  await expect(page.getByText("Percorso non trovato")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Questa pagina non è disponibile nel workspace attuale."
    })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Torna ai media" })).toHaveAttribute(
    "href",
    "/media"
  );
});
