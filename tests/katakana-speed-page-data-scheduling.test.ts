import { afterEach, describe, expect, it, vi } from "vitest";

describe("katakana speed page data query scheduling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/db");
    vi.doUnmock("@/db/queries");
  });

  it("loads recent session analytics with one batched query per table", async () => {
    const database = {};
    const recentSessions = [
      buildSessionRow("katakana-session-new", "2026-04-26T09:00:00.000Z"),
      buildSessionRow("katakana-session-old", "2026-04-25T08:00:00.000Z")
    ];
    const listKatakanaAttemptLogsBySession = vi.fn(async () => []);
    const listKatakanaAttemptLogsBySessions = vi.fn(async () => []);
    const listKatakanaConfusionEdgeRowsBySession = vi.fn(async () => []);
    const listKatakanaConfusionEdgeRowsBySessions = vi.fn(async () => []);
    const listKatakanaExerciseResultRowsBySession = vi.fn(async () => []);
    const listKatakanaExerciseResultRowsBySessions = vi.fn(async () => []);

    vi.doMock("@/db", () => ({
      db: database
    }));
    vi.doMock("@/db/queries", () => ({
      getKatakanaSessionRow: vi.fn(),
      listKatakanaAttemptLogsBySession,
      listKatakanaAttemptLogsBySessions,
      listKatakanaConfusionEdgeRowsBySession,
      listKatakanaConfusionEdgeRowsBySessions,
      listKatakanaExerciseResultRowsBySession,
      listKatakanaExerciseResultRowsBySessions,
      listKatakanaItemStateRows: vi.fn(async () => []),
      listKatakanaTrialRowsBySession: vi.fn(),
      listRecentKatakanaSessionRows: vi.fn(async () => recentSessions)
    }));

    const { getKatakanaSpeedPageData } = await import(
      "@/features/katakana-speed/server/page-data"
    );

    await getKatakanaSpeedPageData({ database: database as never });

    const sessionIds = ["katakana-session-new", "katakana-session-old"];

    expect(listKatakanaAttemptLogsBySessions).toHaveBeenCalledWith(
      database,
      sessionIds
    );
    expect(listKatakanaExerciseResultRowsBySessions).toHaveBeenCalledWith(
      database,
      sessionIds
    );
    expect(listKatakanaConfusionEdgeRowsBySessions).toHaveBeenCalledWith(
      database,
      sessionIds
    );
    expect(listKatakanaAttemptLogsBySession).not.toHaveBeenCalled();
    expect(listKatakanaExerciseResultRowsBySession).not.toHaveBeenCalled();
    expect(listKatakanaConfusionEdgeRowsBySession).not.toHaveBeenCalled();
  });
});

function buildSessionRow(id: string, startedAt: string) {
  return {
    correctAttempts: 0,
    durationMs: null,
    endedAt: null,
    id,
    medianRtMs: null,
    p90RtMs: null,
    recommendedFocusJson: "[]",
    slowCorrectCount: 0,
    startedAt,
    status: "completed",
    totalAttempts: 0
  };
}
