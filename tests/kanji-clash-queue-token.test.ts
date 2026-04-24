import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  advanceKanjiClashQueueSnapshot,
  buildKanjiClashCandidate,
  buildKanjiClashQueueSnapshot,
  createKanjiClashQueueToken,
  type KanjiClashCandidate,
  type KanjiClashEligibleSubject,
  type KanjiClashPairState,
  type KanjiClashQueueSnapshot,
  verifyKanjiClashQueueToken
} from "@/lib/kanji-clash";

function makeSubject(
  input: Partial<KanjiClashEligibleSubject> &
    Pick<KanjiClashEligibleSubject, "label" | "subjectKey">
): KanjiClashEligibleSubject {
  return {
    entryType: "term",
    kanji: input.kanji ?? [input.label[0] ?? "食"],
    label: input.label,
    members: input.members ?? [
      {
        entryId: input.subjectKey,
        lemma: input.label,
        meaningIt: `${input.label} meaning`,
        mediaId: "media-alpha",
        mediaSlug: "alpha",
        mediaTitle: "Alpha",
        reading: input.reading ?? `${input.label}-reading`
      }
    ],
    reading: input.reading ?? `${input.label}-reading`,
    readingForms: input.readingForms ?? [
      input.reading ?? `${input.label}-reading`
    ],
    reps: input.reps ?? 4,
    reviewState: input.reviewState ?? "review",
    source: input.source ?? {
      entryId: input.subjectKey,
      type: "entry"
    },
    stability: input.stability ?? 10,
    subjectKey: input.subjectKey,
    surfaceForms: input.surfaceForms ?? [input.label]
  };
}

function makePairState(
  input: Pick<
    KanjiClashPairState,
    "leftSubjectKey" | "pairKey" | "rightSubjectKey"
  > &
    Partial<KanjiClashPairState>
): KanjiClashPairState {
  return {
    createdAt: input.createdAt ?? "2026-04-08T08:00:00.000Z",
    difficulty: input.difficulty ?? 2.5,
    dueAt: input.dueAt ?? "2026-04-08T08:00:00.000Z",
    lapses: input.lapses ?? 0,
    lastInteractionAt: input.lastInteractionAt ?? "2026-04-08T08:00:00.000Z",
    lastReviewedAt: input.lastReviewedAt ?? "2026-04-08T08:00:00.000Z",
    learningSteps: input.learningSteps ?? 0,
    leftSubjectKey: input.leftSubjectKey,
    pairKey: input.pairKey,
    reps: input.reps ?? 3,
    rightSubjectKey: input.rightSubjectKey,
    scheduledDays: input.scheduledDays ?? 3,
    schedulerVersion: input.schedulerVersion ?? "kanji_clash_fsrs_v1",
    stability: input.stability ?? 8,
    state: input.state ?? "review",
    updatedAt: input.updatedAt ?? "2026-04-08T08:00:00.000Z"
  };
}

function buildFixtureQueue() {
  const alpha = makeSubject({
    kanji: ["食", "費"],
    label: "食費",
    reading: "しょくひ",
    subjectKey: "entry:term:alpha"
  });
  const beta = makeSubject({
    kanji: ["食", "品"],
    label: "食品",
    reading: "しょくひん",
    subjectKey: "entry:term:beta"
  });
  const gamma = makeSubject({
    kanji: ["食", "卓"],
    label: "食卓",
    reading: "しょくたく",
    subjectKey: "entry:term:gamma"
  });
  const delta = makeSubject({
    kanji: ["飲", "食"],
    label: "飲食",
    reading: "いんしょく",
    subjectKey: "entry:term:delta"
  });
  const candidates = [alpha, beta, gamma, delta]
    .flatMap((left, leftIndex, subjects) =>
      subjects
        .slice(leftIndex + 1)
        .map((right) => buildKanjiClashCandidate(left, right))
    )
    .filter(
      (
        candidate
      ): candidate is NonNullable<
        ReturnType<typeof buildKanjiClashCandidate>
      > => candidate !== null
    );
  const pairStates = new Map<string, KanjiClashPairState>();
  const dueCandidate = candidates.find(
    (candidate) => candidate.pairKey === "entry:term:alpha::entry:term:beta"
  );
  const reserveCandidate = candidates.find(
    (candidate) => candidate.pairKey === "entry:term:beta::entry:term:gamma"
  );

  if (!dueCandidate || !reserveCandidate) {
    throw new Error("Missing Kanji Clash queue token fixture candidates.");
  }

  pairStates.set(
    dueCandidate.pairKey,
    makePairState({
      dueAt: "2026-04-08T08:00:00.000Z",
      leftSubjectKey: dueCandidate.leftSubjectKey,
      pairKey: dueCandidate.pairKey,
      rightSubjectKey: dueCandidate.rightSubjectKey,
      state: "review",
      updatedAt: "2026-04-08T08:00:00.000Z"
    })
  );
  pairStates.set(
    reserveCandidate.pairKey,
    makePairState({
      dueAt: "2026-04-12T08:00:00.000Z",
      leftSubjectKey: reserveCandidate.leftSubjectKey,
      pairKey: reserveCandidate.pairKey,
      rightSubjectKey: reserveCandidate.rightSubjectKey,
      state: "review",
      updatedAt: "2026-04-08T09:00:00.000Z"
    })
  );

  const initialQueue = buildKanjiClashQueueSnapshot({
    candidates,
    mode: "manual",
    now: "2026-04-09T12:00:00.000Z",
    pairStates,
    requestedSize: 6,
    scope: "global"
  });
  const currentPairKey = initialQueue.rounds[0]?.pairKey;

  if (!currentPairKey) {
    throw new Error("Missing Kanji Clash queue token fixture round.");
  }

  return advanceKanjiClashQueueSnapshot(initialQueue, currentPairKey, {
    awaitingConfirmation: true
  });
}

function createLegacyQueueToken(queue: KanjiClashQueueSnapshot) {
  const legacyQueue = toLegacyQueueSnapshot(queue);
  const payload = JSON.stringify({
    queue: legacyQueue,
    version: 1
  });
  const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");
  const signature = createHmac("sha256", process.env.AUTH_SESSION_SECRET ?? "")
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

function toLegacyQueueSnapshot(queue: KanjiClashQueueSnapshot) {
  return {
    ...queue,
    rounds: queue.rounds.map((round) => ({
      ...round,
      candidate: stripLegacyCandidateFields(round.candidate)
    }))
  };
}

function stripLegacyCandidateFields(candidate: KanjiClashCandidate) {
  const legacyCandidate = {
    ...candidate
  } as Partial<KanjiClashCandidate>;

  delete legacyCandidate.pairReasons;
  delete legacyCandidate.similarKanjiSwaps;

  return legacyCandidate;
}

describe("kanji clash queue token", () => {
  const originalSecret = process.env.AUTH_SESSION_SECRET;

  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET = "kanji-clash-queue-token-test-secret";
  });

  afterEach(() => {
    if (typeof originalSecret === "string") {
      process.env.AUTH_SESSION_SECRET = originalSecret;
      return;
    }

    delete process.env.AUTH_SESSION_SECRET;
  });

  it("round-trips the current queue snapshot through the compact v2 token", () => {
    const queue = buildFixtureQueue();
    const token = createKanjiClashQueueToken(queue);

    expect(verifyKanjiClashQueueToken(token)).toEqual(queue);
  });

  it("rejects signed tokens with extra segments", () => {
    const queue = buildFixtureQueue();
    const token = createKanjiClashQueueToken(queue);

    expect(verifyKanjiClashQueueToken(`${token}.extra`)).toBeNull();
  });

  it("normalizes legacy v1 tokens and reserializes them successfully", () => {
    const queue = buildFixtureQueue();
    const legacyToken = createLegacyQueueToken(queue);
    const verifiedQueue = verifyKanjiClashQueueToken(legacyToken);

    expect(verifiedQueue).not.toBeNull();
    expect(verifiedQueue?.rounds[0]?.candidate.pairReasons).toEqual([
      "shared-kanji"
    ]);
    expect(verifiedQueue?.rounds[0]?.candidate.similarKanjiSwaps).toEqual([]);

    if (!verifiedQueue) {
      throw new Error("Missing normalized Kanji Clash queue token.");
    }

    expect(verifyKanjiClashQueueToken(createKanjiClashQueueToken(verifiedQueue)))
      .toEqual(verifiedQueue);
  });

  it("emits a smaller payload than the legacy full snapshot token", () => {
    const queue = buildFixtureQueue();
    const v2Token = createKanjiClashQueueToken(queue);
    const legacyToken = createLegacyQueueToken(queue);

    expect(v2Token.length).toBeLessThan(legacyToken.length);
  });

  it("round-trips similar-kanji metadata through the compact token", () => {
    const wait = makeSubject({
      kanji: ["待"],
      label: "待つ",
      reading: "まつ",
      subjectKey: "entry:term:wait"
    });
    const hold = makeSubject({
      kanji: ["持"],
      label: "持つ",
      reading: "もつ",
      subjectKey: "entry:term:hold"
    });
    const candidate = buildKanjiClashCandidate(wait, hold);

    if (!candidate) {
      throw new Error("Missing similar-kanji candidate fixture.");
    }

    const queue = buildKanjiClashQueueSnapshot({
      candidates: [candidate],
      mode: "manual",
      now: "2026-04-09T12:00:00.000Z",
      requestedSize: 1,
      scope: "global"
    });

    expect(
      verifyKanjiClashQueueToken(createKanjiClashQueueToken(queue))
    ).toEqual(queue);
  });

  it("round-trips forced manual contrast round identity and origin metadata", () => {
    const alpha = makeSubject({
      kanji: ["食", "費"],
      label: "食費",
      reading: "しょくひ",
      subjectKey: "entry:term:alpha"
    });
    const beta = makeSubject({
      kanji: ["食", "品"],
      label: "食品",
      reading: "しょくひん",
      subjectKey: "entry:term:beta"
    });
    const candidate = buildKanjiClashCandidate(alpha, beta);

    if (!candidate) {
      throw new Error("Missing forced manual contrast token candidate.");
    }

    const contrastKey = candidate.pairKey;
    const queue = buildKanjiClashQueueSnapshot({
      candidates: [
        {
          ...candidate,
          roundOverride: {
            origin: {
              contrastKey,
              direction: "subject_a",
              type: "manual-contrast"
            },
            roundKey: `${contrastKey}::subject_a`,
            targetSubjectKey: alpha.subjectKey
          }
        },
        {
          ...candidate,
          roundOverride: {
            origin: {
              contrastKey,
              direction: "subject_b",
              type: "manual-contrast"
            },
            roundKey: `${contrastKey}::subject_b`,
            targetSubjectKey: beta.subjectKey
          }
        }
      ],
      mode: "manual",
      now: "2026-04-09T12:00:00.000Z",
      requestedSize: 2,
      scope: "global",
      seenRoundKeys: [`${contrastKey}::subject_a`]
    });
    const token = createKanjiClashQueueToken(queue);

    expect(verifyKanjiClashQueueToken(token)).toEqual(queue);
  });
});
