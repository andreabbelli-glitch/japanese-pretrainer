import {
  listPitchAccentAttemptLogsBySession,
  updatePitchAccentSessionRollup,
  type PitchAccentMutationClient
} from "@/db/queries";
import type { PitchAccentPatternKey } from "../model";

type PitchAccentAttemptLogRow = Awaited<
  ReturnType<typeof listPitchAccentAttemptLogsBySession>
>[number];

export type PitchAccentSessionRollup = {
  readonly correctAttempts: number;
  readonly patternStatsJson: string;
  readonly totalAttempts: number;
};

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

export function buildPitchAccentSessionRollup(
  attempts: readonly PitchAccentAttemptLogRow[]
): PitchAccentSessionRollup {
  const patternStats = structuredClone(emptyPatternStats);

  for (const attempt of attempts) {
    const key = parsePatternKey(attempt.patternKey);
    patternStats[key].total += 1;
    if (attempt.isCorrect === 1) {
      patternStats[key].correct += 1;
    }
  }

  return {
    correctAttempts: attempts.filter((attempt) => attempt.isCorrect === 1)
      .length,
    patternStatsJson: JSON.stringify(patternStats),
    totalAttempts: attempts.length
  };
}

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
  const rollup = buildPitchAccentSessionRollup(
    await listPitchAccentAttemptLogsBySession(database, input.sessionId)
  );

  return updatePitchAccentSessionRollup(database, {
    correctAttempts: rollup.correctAttempts,
    durationMs: input.durationMs,
    endedAt: input.endedAt,
    expectedStatus: input.expectedStatus,
    id: input.sessionId,
    patternStatsJson: rollup.patternStatsJson,
    status: input.status,
    totalAttempts: rollup.totalAttempts,
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
