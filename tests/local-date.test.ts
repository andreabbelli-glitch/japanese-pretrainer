import { describe, expect, it } from "vitest";

import { formatGlossaryShortDate } from "@/lib/glossary-detail-helpers";
import { formatShortIsoDate } from "@/lib/review-queue";

describe("local date formatting", () => {
  it("formats UTC timestamps using the local calendar day", () => {
    const value = "2026-04-10T23:30:00.000Z";

    expect(formatShortIsoDate(value)).toBe("2026-04-11");
    expect(formatGlossaryShortDate(value)).toBe("2026-04-11");
  });

  it("falls back to the ISO prefix for invalid dates", () => {
    expect(formatShortIsoDate("not-a-date-value")).toBe("not-a-date");
  });
});
