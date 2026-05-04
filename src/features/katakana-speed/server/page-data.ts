import { db, type DatabaseClient } from "@/db";
import {
  getKatakanaSessionRow,
  listKatakanaAttemptLogsBySession,
  listKatakanaAttemptLogsBySessions,
  listKatakanaConfusionEdgeRowsBySession,
  listKatakanaConfusionEdgeRowsBySessions,
  listKatakanaExerciseResultRowsBySession,
  listKatakanaExerciseResultRowsBySessions,
  listKatakanaItemStateRows,
  listKatakanaTrialRowsBySession,
  listRecentKatakanaSessionRows
} from "@/db/queries";

import { getKatakanaSpeedCatalog } from "../model/catalog";
import { buildKatakanaSpeedAnalytics } from "../model/analytics";
import type {
  KatakanaSpeedPageData,
  KatakanaSpeedRecapPageData,
  KatakanaSpeedSessionPageData
} from "./contracts";
import {
  hasSupportedKatakanaAttemptMode,
  hasSupportedKatakanaTrialMode
} from "./codecs";
import {
  buildFocusItems,
  mapKatakanaAnalyticsAttemptRow,
  mapKatakanaAnalyticsExerciseResultRow,
  mapKatakanaAnalyticsItemStateRow,
  mapKatakanaAttemptRow,
  mapKatakanaConfusionEdgeRow,
  mapKatakanaExerciseResultRow,
  mapKatakanaSpeedSessionSummary,
  mapKatakanaTrialRow
} from "./mappers";

export async function getKatakanaSpeedPageData(
  input: {
    database?: DatabaseClient;
  } = {}
): Promise<KatakanaSpeedPageData> {
  const database = input.database ?? db;
  const [sessionRows, itemStateRows] = await Promise.all([
    listRecentKatakanaSessionRows(database, 10),
    listKatakanaItemStateRows(database)
  ]);
  const recentSession = sessionRows[0]
    ? mapKatakanaSpeedSessionSummary(sessionRows[0])
    : null;
  const sessionIds = sessionRows.map((session) => session.id);
  const [attempts, exerciseResults, confusionEdges] = await Promise.all([
    listKatakanaAttemptLogsBySessions(database, sessionIds),
    listKatakanaExerciseResultRowsBySessions(database, sessionIds),
    listKatakanaConfusionEdgeRowsBySessions(database, sessionIds)
  ]);
  const analytics = buildKatakanaSpeedAnalytics({
    attempts: attempts
      .filter(hasSupportedKatakanaAttemptMode)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(mapKatakanaAnalyticsAttemptRow),
    confusionEdges: confusionEdges.map(mapKatakanaConfusionEdgeRow),
    exerciseResults: exerciseResults
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(mapKatakanaAnalyticsExerciseResultRow),
    itemStates: itemStateRows.map(mapKatakanaAnalyticsItemStateRow)
  });
  const stateFocusItemIds = itemStateRows
    .filter((row) => row.reps > 0)
    .sort(
      (left, right) =>
        right.lapses - left.lapses ||
        right.slowCorrectCount - left.slowCorrectCount ||
        right.reps - left.reps ||
        left.itemId.localeCompare(right.itemId)
    )
    .map((row) => row.itemId);
  const recentFocusItemIds =
    recentSession?.recommendedFocus.map((focusItem) => focusItem.itemId) ?? [];
  const recommendedFocus = buildFocusItems([
    ...new Set([...stateFocusItemIds, ...recentFocusItemIds])
  ]).slice(0, 6);

  return {
    analytics,
    catalogSize: getKatakanaSpeedCatalog().length,
    recentSession,
    recommendedFocus:
      recommendedFocus.length > 0
        ? recommendedFocus
        : buildFocusItems(["kana-shi", "kana-tsu", "chunk-ti", "chunk-di"])
  };
}

export async function getKatakanaSpeedSessionPageData(input: {
  database?: DatabaseClient;
  sessionId: string;
}): Promise<KatakanaSpeedSessionPageData | null> {
  const database = input.database ?? db;
  const session = await getKatakanaSessionRow(database, input.sessionId);
  if (!session) {
    return null;
  }

  const trialRows = await listKatakanaTrialRowsBySession(
    database,
    input.sessionId
  );
  const supportedTrialRows = trialRows.filter(hasSupportedKatakanaTrialMode);
  const trials = supportedTrialRows.map(mapKatakanaTrialRow);

  return {
    answeredCount: supportedTrialRows.filter(
      (trial) => trial.status === "answered"
    ).length,
    sessionId: session.id,
    startedAt: session.startedAt,
    status: session.status,
    trials
  };
}

export async function getKatakanaSpeedRecapPageData(input: {
  database?: DatabaseClient;
  sessionId: string;
}): Promise<KatakanaSpeedRecapPageData | null> {
  const database = input.database ?? db;
  const session = await getKatakanaSessionRow(database, input.sessionId);
  if (!session) {
    return null;
  }

  const [attempts, exerciseResults, confusionEdges] = await Promise.all([
    listKatakanaAttemptLogsBySession(database, input.sessionId),
    listKatakanaExerciseResultRowsBySession(database, input.sessionId),
    listKatakanaConfusionEdgeRowsBySession(database, input.sessionId)
  ]);
  const mappedAttempts = attempts
    .filter(hasSupportedKatakanaAttemptMode)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map(mapKatakanaAttemptRow);
  const mappedResults = exerciseResults.map(mapKatakanaExerciseResultRow);

  return {
    analytics: buildKatakanaSpeedAnalytics({
      attempts: mappedAttempts,
      confusionEdges: confusionEdges.map(mapKatakanaConfusionEdgeRow),
      exerciseResults: mappedResults,
      itemStates: []
    }),
    attempts: mappedAttempts,
    exerciseResults: mappedResults,
    session: mapKatakanaSpeedSessionSummary(session)
  };
}
