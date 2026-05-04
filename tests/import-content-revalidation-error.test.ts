import { describe, expect, it } from "vitest";

import { readContentCacheRevalidationErrorDetails } from "@/lib/content/importer/revalidation-error";

describe("content import cache revalidation error details", () => {
  it("preserves plain-text error bodies from the revalidation endpoint", async () => {
    const response = new Response("remote cache failed", {
      status: 500
    });

    await expect(
      readContentCacheRevalidationErrorDetails(response)
    ).resolves.toBe("remote cache failed");
  });
});
