import type { DatabaseClient } from "@/db";
import {
  listKatakanaAttemptLogsBySession,
  listKatakanaItemStateRows,
  updateKatakanaSessionRollup,
  upsertKatakanaItemState
} from "@/db/queries";

import { createInitialKatakanaSpeedState } from "../model";
import type {
  KatakanaSpeedErrorTag,
  KatakanaSpeedItemState,
  KatakanaSpeedState
} from "../types";
import {
  countValues,
  hasSupportedKatakanaAttemptMode,
  parseJsonArray,
  percentile,
  topKeys
} from "./codecs";

export async function loadKatakanaSpeedState(
  database: Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0],
  now: Date
): Promise<KatakanaSpeedState> {
  const initial = createInitialKatakanaSpeedState({ now });
  const rows = await listKatakanaItemStateRows(database);

  return {
    ...initial,
    items: {
      ...initial.items,
      ...Object.fromEntries(
        rows.map((row) => [
          row.itemId,
          {
            correctStreak: row.correctStreak,
            itemId: row.itemId,
            lapses: row.lapses,
            lastAttemptAt: row.lastAttemptAt,
            lastCorrectAt: row.lastCorrectAt,
            lastErrorTags: parseJsonArray<KatakanaSpeedErrorTag>(
              row.lastErrorTagsJson
            ),
            lastResponseMs: row.lastResponseMs,
            reps: row.reps,
            slowStreak: row.slowStreak,
            status: row.status
          } satisfies KatakanaSpeedItemState
        ])
      )
    }
  };
}

export async function updateItemStateAfterAttempt(
  database: Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0],
  input: {
    correctnessSource: "objective" | "self_report";
    errorTags: readonly KatakanaSpeedErrorTag[];
    isCorrect: boolean;
    itemId: string;
    nowIso: string;
    responseMs: number;
  }
) {
  const current = await database.query.katakanaItemState.findFirst({
    where: (table, { eq }) => eq(table.itemId, input.itemId)
  });
  const selfReportedWeakness =
    input.correctnessSource === "self_report" && !input.isCorrect;
  const slowCorrect =
    input.errorTags.includes("slow_correct") || selfReportedWeakness;
  const fluentCorrect = input.isCorrect && !slowCorrect;
  const recentResponseMs = [
    ...parseJsonArray<number>(current?.recentResponseMsJson ?? "[]"),
    input.responseMs
  ].slice(-10);
  const correctStreak = fluentCorrect ? (current?.correctStreak ?? 0) + 1 : 0;
  const status =
    fluentCorrect && correctStreak >= 2
      ? "review"
      : input.isCorrect || current?.status !== "new"
        ? "learning"
        : "learning";

  await upsertKatakanaItemState(database, {
    bestRtMs:
      input.isCorrect && !slowCorrect
        ? Math.min(current?.bestRtMs ?? input.responseMs, input.responseMs)
        : (current?.bestRtMs ?? null),
    correctCount: (current?.correctCount ?? 0) + (input.isCorrect ? 1 : 0),
    correctStreak,
    createdAt: current?.createdAt ?? input.nowIso,
    itemId: input.itemId,
    lapses:
      (current?.lapses ?? 0) +
      (!input.isCorrect && input.correctnessSource === "objective" ? 1 : 0),
    lastAttemptAt: input.nowIso,
    lastCorrectAt: fluentCorrect
      ? input.nowIso
      : (current?.lastCorrectAt ?? null),
    lastErrorTagsJson: JSON.stringify(input.errorTags),
    lastResponseMs: input.responseMs,
    recentResponseMsJson: JSON.stringify(recentResponseMs),
    reps: (current?.reps ?? 0) + 1,
    seenCount: (current?.seenCount ?? 0) + 1,
    slowCorrectCount: (current?.slowCorrectCount ?? 0) + (slowCorrect ? 1 : 0),
    slowStreak: slowCorrect
      ? (current?.slowStreak ?? 0) + 1
      : fluentCorrect
        ? 0
        : (current?.slowStreak ?? 0),
    status,
    updatedAt: input.nowIso,
    wrongCount: (current?.wrongCount ?? 0) + (input.isCorrect ? 0 : 1)
  });
}

export async function refreshSessionRollup(
  database: Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0],
  input: {
    durationMs?: number | null;
    endedAt?: string | null;
    nowIso: string;
    sessionId: string;
    status: "active" | "completed" | "abandoned";
  }
) {
  const attempts = (
    await listKatakanaAttemptLogsBySession(database, input.sessionId)
  ).filter(hasSupportedKatakanaAttemptMode);
  const responseTimes = attempts.map((attempt) => attempt.responseMs);
  const errorTagCounts = countValues(
    attempts.flatMap((attempt) =>
      parseJsonArray<KatakanaSpeedErrorTag>(attempt.errorTagsJson)
    )
  );
  const confusionCounts = countValues(
    attempts
      .map((attempt) => attempt.confusedWithItemId)
      .filter((itemId): itemId is string => Boolean(itemId))
  );
  const recommendedFocus = [
    ...new Set([...topKeys(errorTagCounts, 3), ...topKeys(confusionCounts, 3)])
  ];
  const rollup = {
    correctAttempts: attempts.filter((attempt) => attempt.isCorrect === 1)
      .length,
    mainConfusionsJson: JSON.stringify(topKeys(confusionCounts, 5)),
    mainErrorTagsJson: JSON.stringify(topKeys(errorTagCounts, 5)),
    medianRtMs: percentile(responseTimes, 0.5),
    p90RtMs: percentile(responseTimes, 0.9),
    recommendedFocusJson: JSON.stringify(recommendedFocus),
    slowCorrectCount: attempts.filter((attempt) =>
      parseJsonArray<KatakanaSpeedErrorTag>(attempt.errorTagsJson).includes(
        "slow_correct"
      )
    ).length,
    totalAttempts: attempts.length
  };

  await updateKatakanaSessionRollup(database, {
    ...rollup,
    durationMs: input.durationMs ?? null,
    endedAt: input.endedAt ?? null,
    id: input.sessionId,
    status: input.status,
    updatedAt: input.nowIso
  });

  return rollup;
}
