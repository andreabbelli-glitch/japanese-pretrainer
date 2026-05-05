import { describe, expect, it } from "vitest";

import { matchesSecret } from "@/lib/secret-compare";

describe("secret comparison", () => {
  it("matches exact secrets without accepting missing or length-mismatched values", () => {
    expect(matchesSecret("cron-secret", "cron-secret")).toBe(true);
    expect(matchesSecret(null, "cron-secret")).toBe(false);
    expect(matchesSecret(undefined, "cron-secret")).toBe(false);
    expect(matchesSecret("cron", "cron-secret")).toBe(false);
    expect(matchesSecret("cron-secret-extra", "cron-secret")).toBe(false);
  });
});
