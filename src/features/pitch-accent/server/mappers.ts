import {
  defaultPitchAccentFilters,
  normalizePitchAccentFilters,
  type PitchAccentPairOption,
  type PitchAccentPatternKey,
  type PitchAccentSessionTrialPlan
} from "../model";
import type {
  PitchAccentAttemptSummary,
  PitchAccentPatternStats,
  PitchAccentSessionSummary
} from "./contracts";

export type PitchAccentSessionRow = {
  correctAttempts: number;
  durationMs: number | null;
  endedAt: string | null;
  filtersJson: string;
  id: string;
  patternStatsJson: string;
  startedAt: string;
  status: "active" | "completed" | "abandoned";
  totalAttempts: number;
  totalTrials: number;
};

export type PitchAccentTrialRow = {
  correctOptionId: string;
  correctPatternKey: string;
  kana: string;
  optionsJson: string;
  pairId: string;
  sessionId: string;
  sortOrder: number;
  trialId: string;
};

export type PitchAccentAttemptRow = {
  chosenOptionId: string;
  correctOptionId: string;
  createdAt: string;
  inputMethod: string | null;
  isCorrect: number;
  kana: string;
  pairId: string;
  patternKey: string;
  responseMs: number;
  sortOrder: number;
  trialId: string;
};

export function mapPitchAccentSessionSummary(
  row: PitchAccentSessionRow
): PitchAccentSessionSummary {
  return {
    correctAttempts: row.correctAttempts,
    durationMs: row.durationMs,
    endedAt: row.endedAt,
    filters: normalizePitchAccentFilters(parseJson(row.filtersJson)),
    patternStats: parsePatternStats(row.patternStatsJson),
    sessionId: row.id,
    startedAt: row.startedAt,
    status: row.status,
    totalAttempts: row.totalAttempts,
    totalTrials: row.totalTrials
  };
}

export function mapPitchAccentTrialRow(
  row: PitchAccentTrialRow
): PitchAccentSessionTrialPlan {
  return {
    correctOptionId: row.correctOptionId,
    correctPatternKey: parsePatternKey(row.correctPatternKey),
    kana: row.kana,
    options: parseOptions(row.optionsJson),
    pairId: row.pairId,
    sessionId: row.sessionId,
    sortOrder: row.sortOrder,
    trialId: row.trialId
  };
}

export function mapPitchAccentAttemptRow(
  row: PitchAccentAttemptRow
): PitchAccentAttemptSummary {
  return {
    chosenOptionId: row.chosenOptionId,
    correctOptionId: row.correctOptionId,
    createdAt: row.createdAt,
    inputMethod: row.inputMethod,
    isCorrect: row.isCorrect === 1,
    kana: row.kana,
    pairId: row.pairId,
    patternKey: parsePatternKey(row.patternKey),
    responseMs: row.responseMs,
    sortOrder: row.sortOrder,
    trialId: row.trialId
  };
}

function parseOptions(source: string): readonly PitchAccentPairOption[] {
  const parsed = parseJson(source);

  return Array.isArray(parsed) ? (parsed as PitchAccentPairOption[]) : [];
}

function parsePatternStats(
  source: string
): Readonly<Record<PitchAccentPatternKey, PitchAccentPatternStats>> {
  const parsed = parseJson(source);

  return {
    pitch0: parsePatternStat(parsed.pitch0),
    pitch1: parsePatternStat(parsed.pitch1),
    pitch2: parsePatternStat(parsed.pitch2),
    pitch3: parsePatternStat(parsed.pitch3),
    pitch4: parsePatternStat(parsed.pitch4)
  };
}

function parsePatternStat(value: unknown): PitchAccentPatternStats {
  if (!value || typeof value !== "object") {
    return { correct: 0, total: 0 };
  }

  const record = value as Partial<PitchAccentPatternStats>;

  return {
    correct: parseInteger(record.correct),
    total: parseInteger(record.total)
  };
}

function parseInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}

function parsePatternKey(value: string): PitchAccentPatternKey {
  if (
    value === "pitch0" ||
    value === "pitch1" ||
    value === "pitch2" ||
    value === "pitch3" ||
    value === "pitch4"
  ) {
    return value;
  }

  return "pitch0";
}

function parseJson(source: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(source) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : defaultPitchAccentFilters;
  } catch {
    return defaultPitchAccentFilters;
  }
}
