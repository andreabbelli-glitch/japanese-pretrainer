import { describe, expect, it } from "vitest";

import {
  addReviewStudyDays,
  differenceInReviewStudyDays,
  getReviewStudyDay,
  getReviewStudyDayBoundsForKey,
  getReviewStudyDayContext,
  normalizeReviewDueAt
} from "@/features/review/model/study-day";

describe("review study day", () => {
  it("rolls the Europe/Rome study day over at 04:00", () => {
    expect(getReviewStudyDay("2026-01-15T02:59:59.999Z")).toBe("2026-01-14");
    expect(getReviewStudyDay("2026-01-15T03:00:00.000Z")).toBe("2026-01-15");
    expect(getReviewStudyDayContext("2026-01-15T03:00:00.000Z")).toMatchObject({
      dayEndIso: "2026-01-16T03:00:00.000Z",
      dayStartIso: "2026-01-15T03:00:00.000Z",
      policyKey: "study-day:v1:Europe/Rome:rollover-240",
      studyDay: "2026-01-15"
    });
  });

  it("uses 23-hour bounds across the spring DST transition", () => {
    const bounds = getReviewStudyDayBoundsForKey("2026-03-28");

    expect(bounds).toMatchObject({
      dayEndIso: "2026-03-29T02:00:00.000Z",
      dayStartIso: "2026-03-28T03:00:00.000Z"
    });
    expect(bounds.dayEnd.getTime() - bounds.dayStart.getTime()).toBe(
      23 * 60 * 60_000
    );
  });

  it("uses 25-hour bounds across the autumn DST transition", () => {
    const bounds = getReviewStudyDayBoundsForKey("2026-10-24");

    expect(bounds).toMatchObject({
      dayEndIso: "2026-10-25T03:00:00.000Z",
      dayStartIso: "2026-10-24T02:00:00.000Z"
    });
    expect(bounds.dayEnd.getTime() - bounds.dayStart.getTime()).toBe(
      25 * 60 * 60_000
    );
  });

  it("measures FSRS elapsed days by logical day rather than milliseconds", () => {
    expect(
      differenceInReviewStudyDays(
        "2026-03-28T03:00:00.000Z",
        "2026-03-29T02:00:00.000Z"
      )
    ).toBe(1);
    expect(
      differenceInReviewStudyDays(
        "2026-10-24T02:00:00.000Z",
        "2026-10-25T03:00:00.000Z"
      )
    ).toBe(1);
    expect(
      differenceInReviewStudyDays(
        "2026-05-19T23:58:00.000Z",
        "2026-05-20T00:02:00.000Z"
      )
    ).toBe(0);
  });

  it("adds calendar study days without accumulating DST drift", () => {
    expect(addReviewStudyDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addReviewStudyDays("2026-10-24", 1)).toBe("2026-10-25");
  });

  it("normalizes daily due dates and preserves intraday steps", () => {
    const proposed = "2026-03-29T12:34:56.000Z";

    expect(
      normalizeReviewDueAt({
        dueAt: proposed,
        reviewedAt: "2026-03-28T10:00:00.000Z",
        scheduledDays: 1
      }).toISOString()
    ).toBe("2026-03-29T02:00:00.000Z");
    expect(
      normalizeReviewDueAt({
        dueAt: proposed,
        reviewedAt: "2026-03-28T10:00:00.000Z",
        scheduledDays: 0
      }).toISOString()
    ).toBe(proposed);
  });
});
