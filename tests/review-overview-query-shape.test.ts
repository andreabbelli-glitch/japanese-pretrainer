import { describe, expect, it, vi } from "vitest";

import type { DatabaseQueryClient } from "@/db/client";
import { listReviewLaunchCandidates } from "@/db/queries/review";

describe("review overview query shape", () => {
  it("joins first-due and first-new rows instead of using correlated subqueries per media", async () => {
    const allSpy = vi.fn<(sql: string) => Promise<never[]>>(async () => []);
    const database = {
      all: allSpy
    } as unknown as DatabaseQueryClient;

    await listReviewLaunchCandidates(database, "2026-04-21T10:00:00.000Z");

    const sql = allSpy.mock.calls[0]?.[0];

    expect(allSpy).toHaveBeenCalledTimes(1);
    expect(typeof sql).toBe("string");
    expect(sql).toContain("LEFT JOIN due_fronts");
    expect(sql).toContain("LEFT JOIN new_fronts");
    expect(sql).not.toContain("(SELECT front FROM due_fronts");
    expect(sql).not.toContain("(SELECT front FROM new_fronts");
  });
});
