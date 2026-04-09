import type { DatabaseClient } from "@/db";
import {
  listKanjiClashDuePairStates,
  listKanjiClashPairStatesByPairKeys
} from "@/db/queries";

import { buildKanjiClashQueueSnapshot } from "./queue.ts";
import {
  buildKanjiClashCandidate,
  generateKanjiClashCandidates
} from "./pairing.ts";
import type {
  KanjiClashCandidate,
  KanjiClashEligibleSubject,
  KanjiClashPairState,
  KanjiClashQueueSnapshot,
  KanjiClashScope
} from "./types.ts";

const MANUAL_DUE_PAGE_SIZE_MULTIPLIER = 4;
const MANUAL_FRONTIER_EXPANSION_MULTIPLIER = 4;
const MANUAL_FRONTIER_MULTIPLIER = 6;
const MANUAL_FRONTIER_MIN_SIZE = 16;

export async function loadManualKanjiClashQueueSnapshot(input: {
  database: DatabaseClient;
  eligibleSubjects: KanjiClashEligibleSubject[];
  now: Date;
  requestedSize?: number | null;
  scope: KanjiClashScope;
  seenPairKeys?: string[];
}): Promise<KanjiClashQueueSnapshot> {
  const requestedSize = normalizePositiveInteger(input.requestedSize, 20);
  const seenPairKeys = dedupeStable(input.seenPairKeys ?? []);

  if (requestedSize <= 0) {
    return buildKanjiClashQueueSnapshot({
      candidates: [],
      mode: "manual",
      newIntroducedTodayCount: 0,
      now: input.now,
      pairStates: new Map<string, KanjiClashPairState>(),
      requestedSize,
      scope: input.scope,
      seenPairKeys
    });
  }

  const eligibleSubjectsByKey = new Map(
    input.eligibleSubjects.map((subject) => [subject.subjectKey, subject])
  );
  const dueSeed = await collectManualDueCandidates({
    database: input.database,
    eligibleSubjectsByKey,
    now: input.now,
    requestedSize,
    seenPairKeys
  });
  const combinedCandidates: KanjiClashCandidate[] = [...dueSeed.candidates];
  const combinedPairStates = new Map(dueSeed.pairStates);
  const combinedPairKeySet = new Set([
    ...seenPairKeys,
    ...dueSeed.candidates.map((candidate) => candidate.pairKey)
  ]);
  let frontierSize = Math.min(
    input.eligibleSubjects.length,
    Math.max(
      requestedSize * MANUAL_FRONTIER_MULTIPLIER,
      MANUAL_FRONTIER_MIN_SIZE
    )
  );

  if (combinedCandidates.length < requestedSize) {
    while (true) {
      const frontierSubjects = input.eligibleSubjects.slice(0, frontierSize);
      const frontierCandidates = generateKanjiClashCandidates(
        frontierSubjects
      ).filter((candidate) => !combinedPairKeySet.has(candidate.pairKey));

      if (frontierCandidates.length > 0) {
        const frontierPairStates = await listKanjiClashPairStatesByPairKeys(
          input.database,
          frontierCandidates.map((candidate) => candidate.pairKey)
        );

        for (const [pairKey, pairState] of frontierPairStates) {
          combinedPairStates.set(pairKey, pairState);
        }

        for (const candidate of frontierCandidates) {
          combinedCandidates.push(candidate);
          combinedPairKeySet.add(candidate.pairKey);
        }
      }

      const queue = buildKanjiClashQueueSnapshot({
        candidates: combinedCandidates,
        mode: "manual",
        newIntroducedTodayCount: 0,
        now: input.now,
        pairStates: combinedPairStates,
        requestedSize,
        scope: input.scope,
        seenPairKeys
      });

      if (
        queue.totalCount >= requestedSize ||
        frontierSize >= input.eligibleSubjects.length
      ) {
        return queue;
      }

      const nextFrontierSize = Math.min(
        input.eligibleSubjects.length,
        frontierSize +
          Math.max(
            requestedSize * MANUAL_FRONTIER_EXPANSION_MULTIPLIER,
            MANUAL_FRONTIER_MIN_SIZE
          )
      );

      if (nextFrontierSize <= frontierSize) {
        return queue;
      }

      frontierSize = nextFrontierSize;
    }
  }

  return buildKanjiClashQueueSnapshot({
    candidates: combinedCandidates,
    mode: "manual",
    newIntroducedTodayCount: 0,
    now: input.now,
    pairStates: combinedPairStates,
    requestedSize,
    scope: input.scope,
    seenPairKeys
  });
}

async function collectManualDueCandidates(input: {
  database: DatabaseClient;
  eligibleSubjectsByKey: Map<string, KanjiClashEligibleSubject>;
  now: Date;
  requestedSize: number;
  seenPairKeys: string[];
}): Promise<{
  candidates: KanjiClashCandidate[];
  pairStates: Map<string, KanjiClashPairState>;
}> {
  const candidates: KanjiClashCandidate[] = [];
  const pairStates = new Map<string, KanjiClashPairState>();
  const seenPairKeySet = new Set(
    input.seenPairKeys.filter((pairKey) => pairKey.length > 0)
  );
  const pageSize = Math.max(
    MANUAL_FRONTIER_MIN_SIZE,
    input.requestedSize * MANUAL_DUE_PAGE_SIZE_MULTIPLIER
  );

  for (
    let offset = 0;
    candidates.length < input.requestedSize;
    offset += pageSize
  ) {
    const duePairStates = await listKanjiClashDuePairStates(input.database, {
      limit: pageSize,
      now: input.now.toISOString(),
      offset
    });

    if (duePairStates.length === 0) {
      break;
    }

    for (const pairState of duePairStates) {
      if (seenPairKeySet.has(pairState.pairKey)) {
        continue;
      }

      const left = input.eligibleSubjectsByKey.get(pairState.leftSubjectKey);
      const right = input.eligibleSubjectsByKey.get(pairState.rightSubjectKey);

      if (!left || !right) {
        continue;
      }

      const candidate = buildKanjiClashCandidate(left, right);

      if (!candidate || seenPairKeySet.has(candidate.pairKey)) {
        continue;
      }

      seenPairKeySet.add(candidate.pairKey);
      candidates.push(candidate);
      pairStates.set(candidate.pairKey, pairState);

      if (candidates.length >= input.requestedSize) {
        break;
      }
    }

    if (duePairStates.length < pageSize) {
      break;
    }
  }

  return {
    candidates,
    pairStates
  };
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
