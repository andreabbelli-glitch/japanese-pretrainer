import type { Locator } from "@playwright/test";

export async function enterSearchQuery(searchbox: Locator, query: string) {
  await searchbox.click();
  await searchbox.fill("");
  await searchbox.pressSequentially(query);
}
