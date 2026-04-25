import type { DashboardData } from "@/lib/dashboard";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDashboardDataMock } = vi.hoisted(() => ({
  getDashboardDataMock: vi.fn()
}));

vi.mock("@/lib/dashboard", () => ({
  getDashboardData: getDashboardDataMock
}));

import { loadDashboardRouteData } from "@/app/route-data";

describe("dashboard route data", () => {
  beforeEach(() => {
    getDashboardDataMock.mockReset();
  });

  it("loads dashboard data through the dashboard data loader", async () => {
    const dashboardData: DashboardData = {
      focusMedia: null,
      reviewMedia: null,
      media: [],
      review: {
        activeReviewCards: 0,
        cardsDue: 0,
        queueCount: 0,
        newQueuedCount: 0,
        queueLabel: "Nessuna card in coda"
      },
      totals: {
        lessonsCompleted: 0,
        lessonsTotal: 0,
        entriesKnown: 0,
        entriesTotal: 0
      }
    };

    getDashboardDataMock.mockResolvedValue(dashboardData);

    await expect(loadDashboardRouteData()).resolves.toBe(dashboardData);
    expect(getDashboardDataMock).toHaveBeenCalledTimes(1);
    expect(getDashboardDataMock).toHaveBeenCalledWith();
  });
});
