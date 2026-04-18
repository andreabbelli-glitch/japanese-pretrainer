import type { DatabaseClient } from "@/db";
import {
  listKanjiClashDuePairStates,
  listKanjiClashPairStatesByPairKeys
} from "@/db/queries";

import type { KanjiClashManualContrastSeed } from "./manual-contrast.ts";
import { buildKanjiClashQueueSnapshot } from "./queue.ts";
import {
  buildKanjiClashCandidate,
  collectKanjiClashRelatedSubjects
} from "./pairing.ts";
import {
  DEFAULT_KANJI_CLASH_MANUAL_SIZE,
  dedupeStable,
  normalizePositiveInteger
} from "./shared-utils.ts";
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
  manualContrastSeed: KanjiClashManualContrastSeed;
  now: Date;
  requestedSize?: number | null;
  scope: KanjiClashScope;
  seenPairKeys?: string[];
  seenRoundKeys?: string[];
}): Promise<KanjiClashQueueSnapshot> {
  const requestedSize = normalizePositiveInteger(
    input.requestedSize,
    DEFAULT_KANJI_CLASH_MANUAL_SIZE
  );
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
      seenPairKeys,
      seenRoundKeys: input.seenRoundKeys
    });
  }

  const eligibleSubjectsByKey = new Map(
    input.eligibleSubjects.map((subject) => [subject.subjectKey, subject])
  );
  const dueSeed = await collectManualDueCandidates({
    database: input.database,
    eligibleSubjectsByKey,
    now: input.now,
    pairKeysToSuppress: input.manualContrastSeed.suppressedContrastKeys,
    requestedSize,
    seenPairKeys
  });
  const combinedCandidates: KanjiClashCandidate[] = [
    ...input.manualContrastSeed.candidates,
    ...dueSeed.candidates
  ];
  const combinedPairStates = new Map<string, KanjiClashPairState>([
    ...input.manualContrastSeed.pairStates,
    ...dueSeed.pairStates
  ]);
  const combinedPairKeySet = new Set([
    ...seenPairKeys,
    ...input.manualContrastSeed.candidates.map((candidate) => candidate.pairKey),
    ...dueSeed.candidates.map((candidate) => candidate.pairKey)
  ]);
  let frontierSize = Math.min(
    input.eligibleSubjects.length,
    Math.max(
      requestedSize * MANUAL_FRONTIER_MULTIPLIER,
      MANUAL_FRONTIER_MIN_SIZE
    )
  );
  let indexedFrontierSize = 0;
  const frontierIndex = new Map<string, KanjiClashEligibleSubject[]>();

  if (combinedCandidates.length < requestedSize) {
    while (true) {
      const frontierSubjects = input.eligibleSubjects.slice(
        indexedFrontierSize,
        frontierSize
      );
      const frontierCandidates = collectManualFrontierExpansionCandidates({
        frontierIndex,
        pairKeysToSkip: combinedPairKeySet,
        pairKeysToSuppress: input.manualContrastSeed.suppressedContrastKeys,
        subjects: frontierSubjects
      });
      indexedFrontierSize = frontierSize;

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
        seenPairKeys,
        seenRoundKeys: input.seenRoundKeys
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
    seenPairKeys,
    seenRoundKeys: input.seenRoundKeys
  });
}

async function collectManualDueCandidates(input: {
  database: DatabaseClient;
  eligibleSubjectsByKey: Map<string, KanjiClashEligibleSubject>;
  now: Date;
  pairKeysToSuppress: Set<string>;
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

      if (
        !candidate ||
        seenPairKeySet.has(candidate.pairKey) ||
        input.pairKeysToSuppress.has(candidate.pairKey)
      ) {
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

function collectManualFrontierExpansionCandidates(input: {
  frontierIndex: Map<string, KanjiClashEligibleSubject[]>;
  pairKeysToSkip: Set<string>;
  pairKeysToSuppress: Set<string>;
  subjects: KanjiClashEligibleSubject[];
}) {
  const candidatesByPairKey = new Map<string, KanjiClashCandidate>();

  for (const subject of input.subjects) {
    for (const relatedSubject of collectKanjiClashRelatedSubjects(
      subject,
      input.frontierIndex
    )) {
      const candidate = buildKanjiClashCandidate(subject, relatedSubject);

      if (
        !candidate ||
        input.pairKeysToSkip.has(candidate.pairKey) ||
        input.pairKeysToSuppress.has(candidate.pairKey)
      ) {
        continue;
      }

      const existing = candidatesByPairKey.get(candidate.pairKey);

      if (
        !existing ||
        candidate.score > existing.score ||
        (candidate.score === existing.score &&
          candidate.pairKey.localeCompare(existing.pairKey) < 0)
      ) {
        candidatesByPairKey.set(candidate.pairKey, candidate);
      }
    }

    for (const kanji of subject.kanji) {
      const bucket = input.frontierIndex.get(kanji);

      if (bucket) {
        bucket.push(subject);
        continue;
      }

      input.frontierIndex.set(kanji, [subject]);
    }
  }

  return [...candidatesByPairKey.values()].sort((left, right) => {
    const scoreDifference = right.score - left.score;

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return left.pairKey.localeCompare(right.pairKey);
  });
}
