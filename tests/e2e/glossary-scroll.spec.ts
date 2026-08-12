import { expect, test } from "@playwright/test";

test("renders a recoverable not-found page for the legacy local glossary route", async ({
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
  const mediaLibraryLink = page.getByRole("link", { name: "Torna ai media" });

  await expect(mediaLibraryLink).toHaveAttribute("href", "/media");
  await mediaLibraryLink.click();

  await expect(page).toHaveURL("/media");
  await expect(
    page.locator('.library-card__overlay-link[href="/media/duel-masters-dm25"]')
  ).toBeVisible();
});
