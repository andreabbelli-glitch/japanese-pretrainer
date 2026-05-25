import {
  listPitchAccentAttemptLogsBySession,
  updatePitchAccentSessionRollup,
  type PitchAccentMutationClient
} from "@/db/queries";
import type { PitchAccentPatternKey } from "../model";

const emptyPatternStats: Record<
  PitchAccentPatternKey,
  { correct: number; total: number }
> = {
  pitch0: { correct: 0, total: 0 },
  pitch1: { correct: 0, total: 0 },
  pitch2: { correct: 0, total: 0 },
  pitch3: { correct: 0, total: 0 },
  pitch4: { correct: 0, total: 0 }
};

export async function refreshPitchAccentSessionRollup(
  database: PitchAccentMutationClient,
  input: {
    readonly durationMs?: number | null;
    readonly endedAt?: string | null;
    readonly expectedStatus?: "active" | "completed" | "abandoned";
    readonly sessionId: string;
    readonly status?: "active" | "completed" | "abandoned";
    readonly updatedAt: string;
  }
) {
  const attempts = await listPitchAccentAttemptLogsBySession(
    database,
    input.sessionId
  );
  const patternStats = structuredClone(emptyPatternStats);

  for (const attempt of attempts) {
    const key = parsePatternKey(attempt.patternKey);
    patternStats[key].total += 1;
    if (attempt.isCorrect === 1) {
      patternStats[key].correct += 1;
    }
  }

  return updatePitchAccentSessionRollup(database, {
    correctAttempts: attempts.filter((attempt) => attempt.isCorrect === 1)
      .length,
    durationMs: input.durationMs,
    endedAt: input.endedAt,
    expectedStatus: input.expectedStatus,
    id: input.sessionId,
    patternStatsJson: JSON.stringify(patternStats),
    status: input.status,
    totalAttempts: attempts.length,
    updatedAt: input.updatedAt
  });
}

function parsePatternKey(value: string): PitchAccentPatternKey {
  return value === "pitch1" ||
    value === "pitch2" ||
    value === "pitch3" ||
    value === "pitch4"
    ? value
    : "pitch0";
}
