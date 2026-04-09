import type {
  KanjiClashCandidate,
  KanjiClashPairState,
  KanjiClashQueueSnapshot,
  KanjiClashRoundSource,
  KanjiClashSessionMode,
  KanjiClashSessionRound,
  KanjiClashScope
} from "./types.ts";
import { hashKanjiClashString } from "./utils.ts";

const DEFAULT_KANJI_CLASH_DAILY_NEW_LIMIT = 5;
const DEFAULT_KANJI_CLASH_MANUAL_SIZE = 20;

type BuildKanjiClashQueueSnapshotInput = {
  candidates: KanjiClashCandidate[];
  currentRoundIndex?: number;
  dailyNewLimit?: number | null;
  mode: KanjiClashSessionMode;
  newIntroducedTodayCount?: number;
  now: Date | string;
  pairStates?: Map<string, KanjiClashPairState>;
  requestedSize?: number | null;
  scope: KanjiClashScope;
  seenPairKeys?: string[];
};

type KanjiClashQueuedCandidate = {
  candidate: KanjiClashCandidate;
  pairState: KanjiClashPairState | null;
  source: KanjiClashRoundSource;
};

export function buildKanjiClashQueueSnapshot(
  input: BuildKanjiClashQueueSnapshotInput
): KanjiClashQueueSnapshot {
  const now = toDate(input.now);
  const pairStates = input.pairStates ?? new Map<string, KanjiClashPairState>();
  const seenPairKeys = dedupeStable(input.seenPairKeys ?? []);
  const seenPairKeySet = new Set(seenPairKeys);
  const currentRoundIndex = normalizePositiveInteger(
    input.currentRoundIndex,
    0
  );
  const queuedCandidates = input.candidates
    .filter((candidate) => !seenPairKeySet.has(candidate.pairKey))
    .map((candidate) => {
      const pairState = pairStates.get(candidate.pairKey) ?? null;

      return {
        candidate,
        pairState,
        source: resolveKanjiClashRoundSource(pairState, now)
      } satisfies KanjiClashQueuedCandidate;
    })
    .sort(compareQueuedCandidates);

  const dueCandidates = queuedCandidates.filter(
    (candidate) => candidate.source === "due"
  );
  const newCandidates = queuedCandidates.filter(
    (candidate) => candidate.source === "new"
  );
  const reserveCandidates = queuedCandidates.filter(
    (candidate) => candidate.source === "reserve"
  );
  const dailyNewLimit =
    input.mode === "automatic"
      ? normalizePositiveInteger(
          input.dailyNewLimit,
          DEFAULT_KANJI_CLASH_DAILY_NEW_LIMIT
        )
      : null;
  const requestedSize =
    input.mode === "manual"
      ? normalizePositiveInteger(
          input.requestedSize,
          DEFAULT_KANJI_CLASH_MANUAL_SIZE
        )
      : null;
  const introducedTodayCount = normalizePositiveInteger(
    input.newIntroducedTodayCount,
    0
  );
  const remainingNewSlots =
    input.mode === "automatic"
      ? Math.max(0, (dailyNewLimit ?? 0) - introducedTodayCount)
      : null;
  const selectedCandidates =
    input.mode === "automatic"
      ? [...dueCandidates, ...newCandidates.slice(0, remainingNewSlots ?? 0)]
      : [...dueCandidates, ...newCandidates, ...reserveCandidates].slice(
          0,
          requestedSize ?? DEFAULT_KANJI_CLASH_MANUAL_SIZE
        );
  const rounds = selectedCandidates.map((candidate, index) =>
    materializeKanjiClashSessionRound(candidate, index)
  );
  const clampedRoundIndex = Math.min(currentRoundIndex, rounds.length);

  return {
    awaitingConfirmation: false,
    currentRoundIndex: clampedRoundIndex,
    dailyNewLimit,
    dueCount: rounds.filter((round) => round.source === "due").length,
    finished: rounds.length === 0 || clampedRoundIndex >= rounds.length,
    introducedTodayCount,
    mode: input.mode,
    newAvailableCount: newCandidates.length,
    newQueuedCount: rounds.filter((round) => round.source === "new").length,
    remainingCount: Math.max(0, rounds.length - clampedRoundIndex),
    requestedSize,
    reserveCount: rounds.filter((round) => round.source === "reserve").length,
    rounds,
    snapshotAtIso: now.toISOString(),
    scope: input.scope,
    seenPairKeys,
    totalCount: rounds.length
  };
}

export function getKanjiClashCurrentRound(
  queue: KanjiClashQueueSnapshot
): KanjiClashSessionRound | null {
  return queue.rounds[queue.currentRoundIndex] ?? null;
}

export function advanceKanjiClashQueueSnapshot(
  current: KanjiClashQueueSnapshot,
  consumedPairKey: string,
  options: {
    awaitingConfirmation?: boolean;
  } = {}
): KanjiClashQueueSnapshot {
  const currentRoundIndex = Math.min(
    current.currentRoundIndex + 1,
    current.rounds.length
  );

  return {
    ...current,
    awaitingConfirmation: options.awaitingConfirmation ?? false,
    currentRoundIndex,
    finished: currentRoundIndex >= current.rounds.length,
    remainingCount: Math.max(0, current.rounds.length - currentRoundIndex),
    seenPairKeys: dedupeStable([...current.seenPairKeys, consumedPairKey])
  };
}

export function materializeKanjiClashSessionRound(
  queuedCandidate: KanjiClashQueuedCandidate,
  index: number
): KanjiClashSessionRound {
  const seed = hashKanjiClashString(
    `${queuedCandidate.candidate.pairKey}:${index}`
  );
  const swapDisplaySides = seed % 2 === 1;
  const left = swapDisplaySides
    ? queuedCandidate.candidate.right
    : queuedCandidate.candidate.left;
  const right = swapDisplaySides
    ? queuedCandidate.candidate.left
    : queuedCandidate.candidate.right;
  const targetPlacement = seed % 4 < 2 ? "left" : "right";
  const target = targetPlacement === "left" ? left : right;

  return {
    candidate: queuedCandidate.candidate,
    correctSubjectKey: target.subjectKey,
    left,
    leftSubjectKey: left.subjectKey,
    pairKey: queuedCandidate.candidate.pairKey,
    pairState: queuedCandidate.pairState,
    right,
    rightSubjectKey: right.subjectKey,
    source: queuedCandidate.source,
    target,
    targetPlacement,
    targetSubjectKey: target.subjectKey
  };
}

function resolveKanjiClashRoundSource(
  pairState: KanjiClashPairState | null,
  now: Date
): KanjiClashRoundSource {
  if (!pairState || pairState.state === "new") {
    return "new";
  }

  if (isKanjiClashPairDue(pairState, now)) {
    return "due";
  }

  return "reserve";
}

function isKanjiClashPairDue(pairState: KanjiClashPairState, now: Date) {
  if (pairState.state === "new") {
    return false;
  }

  if (!pairState.dueAt) {
    return true;
  }

  return toDate(pairState.dueAt).getTime() <= now.getTime();
}

function compareQueuedCandidates(
  left: KanjiClashQueuedCandidate,
  right: KanjiClashQueuedCandidate
) {
  const sourceDifference =
    roundSourceRank(left.source) - roundSourceRank(right.source);

  if (sourceDifference !== 0) {
    return sourceDifference;
  }

  if (left.source === "due" && right.source === "due") {
    const leftDueAt = left.pairState?.dueAt
      ? toDate(left.pairState.dueAt).getTime()
      : 0;
    const rightDueAt = right.pairState?.dueAt
      ? toDate(right.pairState.dueAt).getTime()
      : 0;

    if (leftDueAt !== rightDueAt) {
      return leftDueAt - rightDueAt;
    }
  }

  if (left.candidate.score !== right.candidate.score) {
    return right.candidate.score - left.candidate.score;
  }

  return left.candidate.pairKey.localeCompare(right.candidate.pairKey);
}

function roundSourceRank(source: KanjiClashRoundSource) {
  switch (source) {
    case "due":
      return 0;
    case "new":
      return 1;
    case "reserve":
      return 2;
  }
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fallback: number
) {
  if (!Number.isFinite(value)) {
    return Math.max(0, Math.trunc(fallback));
  }

  return Math.max(0, Math.trunc(value ?? fallback));
}

function dedupeStable(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}
