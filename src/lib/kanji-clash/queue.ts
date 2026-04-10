import type {
  KanjiClashCandidate,
  KanjiClashPairState,
  KanjiClashQueueSnapshot,
  KanjiClashRoundSource,
  KanjiClashSessionMode,
  KanjiClashSessionRound,
  KanjiClashScope
} from "./types.ts";
import {
  DEFAULT_KANJI_CLASH_MANUAL_SIZE,
  dedupeStable,
  normalizePositiveInteger
} from "./shared-utils.ts";
import { hashKanjiClashString } from "./utils.ts";

const DEFAULT_KANJI_CLASH_DAILY_NEW_LIMIT = 5;

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
  const normalizedInput = normalizeBuildKanjiClashQueueSnapshotInput(input);
  const { queuedCandidates, newAvailableCount } = buildQueuedCandidates({
    candidates: normalizedInput.candidates,
    now: normalizedInput.now,
    pairStates: normalizedInput.pairStates,
    seenPairKeys: normalizedInput.seenPairKeys
  });
  const selectedCandidates = selectQueuedCandidates({
    manualSelectionLimit: normalizedInput.manualSelectionLimit,
    mode: normalizedInput.mode,
    queuedCandidates,
    remainingNewSlots: normalizedInput.remainingNewSlots
  });
  const { dueCount, newQueuedCount, reserveCount, rounds } =
    summarizeSelectedCandidates(selectedCandidates);
  const clampedRoundIndex = Math.min(
    normalizedInput.currentRoundIndex,
    rounds.length
  );

  return {
    awaitingConfirmation: false,
    currentRoundIndex: clampedRoundIndex,
    dailyNewLimit: normalizedInput.dailyNewLimit,
    dueCount,
    finished: rounds.length === 0 || clampedRoundIndex >= rounds.length,
    introducedTodayCount: normalizedInput.introducedTodayCount,
    mode: normalizedInput.mode,
    newAvailableCount,
    newQueuedCount,
    remainingCount: Math.max(0, rounds.length - clampedRoundIndex),
    requestedSize: normalizedInput.requestedSize,
    reserveCount,
    rounds,
    snapshotAtIso: normalizedInput.now.toISOString(),
    scope: normalizedInput.scope,
    seenPairKeys: normalizedInput.seenPairKeys,
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

function normalizeBuildKanjiClashQueueSnapshotInput(
  input: BuildKanjiClashQueueSnapshotInput
) {
  const now = toDate(input.now);
  const pairStates = input.pairStates ?? new Map<string, KanjiClashPairState>();
  const seenPairKeys = dedupeStable(input.seenPairKeys ?? []);
  const mode = input.mode;
  const dailyNewLimit =
    mode === "automatic"
      ? normalizePositiveInteger(
          input.dailyNewLimit,
          DEFAULT_KANJI_CLASH_DAILY_NEW_LIMIT
        )
      : null;
  const requestedSize =
    mode === "manual"
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
    mode === "automatic"
      ? Math.max(0, (dailyNewLimit ?? 0) - introducedTodayCount)
      : null;

  return {
    candidates: input.candidates,
    currentRoundIndex: normalizePositiveInteger(input.currentRoundIndex, 0),
    dailyNewLimit,
    introducedTodayCount,
    manualSelectionLimit: requestedSize ?? DEFAULT_KANJI_CLASH_MANUAL_SIZE,
    mode,
    now,
    pairStates,
    remainingNewSlots,
    requestedSize,
    scope: input.scope,
    seenPairKeys
  };
}

function buildQueuedCandidates(input: {
  candidates: KanjiClashCandidate[];
  now: Date;
  pairStates: Map<string, KanjiClashPairState>;
  seenPairKeys: string[];
}) {
  const seenPairKeySet = new Set(input.seenPairKeys);
  const queuedCandidates: KanjiClashQueuedCandidate[] = [];
  let newAvailableCount = 0;

  for (const candidate of input.candidates) {
    if (seenPairKeySet.has(candidate.pairKey)) {
      continue;
    }

    const pairState = input.pairStates.get(candidate.pairKey) ?? null;
    const source = resolveKanjiClashRoundSource(pairState, input.now);

    if (source === "new") {
      newAvailableCount += 1;
    }

    queuedCandidates.push({
      candidate,
      pairState,
      source
    });
  }

  queuedCandidates.sort(compareQueuedCandidates);

  return {
    newAvailableCount,
    queuedCandidates
  };
}

function selectQueuedCandidates(input: {
  manualSelectionLimit: number;
  mode: KanjiClashSessionMode;
  queuedCandidates: KanjiClashQueuedCandidate[];
  remainingNewSlots: number | null;
}) {
  return input.mode === "automatic"
    ? selectAutomaticQueuedCandidates(
        input.queuedCandidates,
        input.remainingNewSlots ?? 0
      )
    : selectManualQueuedCandidates(
        input.queuedCandidates,
        input.manualSelectionLimit
      );
}

function selectAutomaticQueuedCandidates(
  queuedCandidates: KanjiClashQueuedCandidate[],
  remainingNewSlots: number
) {
  const selectedCandidates: KanjiClashQueuedCandidate[] = [];
  let selectedDueCount = 0;

  for (const queuedCandidate of queuedCandidates) {
    if (queuedCandidate.source === "reserve") {
      continue;
    }

    if (
      queuedCandidate.source === "new" &&
      selectedCandidates.length - selectedDueCount >= remainingNewSlots
    ) {
      continue;
    }

    selectedCandidates.push(queuedCandidate);

    if (queuedCandidate.source === "due") {
      selectedDueCount += 1;
    }
  }

  return selectedCandidates;
}

function selectManualQueuedCandidates(
  queuedCandidates: KanjiClashQueuedCandidate[],
  manualSelectionLimit: number
) {
  const selectedCandidates: KanjiClashQueuedCandidate[] = [];

  for (const queuedCandidate of queuedCandidates) {
    if (selectedCandidates.length >= manualSelectionLimit) {
      break;
    }

    selectedCandidates.push(queuedCandidate);
  }

  return selectedCandidates;
}

function summarizeSelectedCandidates(
  selectedCandidates: KanjiClashQueuedCandidate[]
) {
  let dueCount = 0;
  let newQueuedCount = 0;
  let reserveCount = 0;
  const rounds = selectedCandidates.map((candidate, index) => {
    switch (candidate.source) {
      case "due":
        dueCount += 1;
        break;
      case "new":
        newQueuedCount += 1;
        break;
      case "reserve":
        reserveCount += 1;
        break;
    }

    return materializeKanjiClashSessionRound(candidate, index);
  });

  return {
    dueCount,
    newQueuedCount,
    reserveCount,
    rounds
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

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}
