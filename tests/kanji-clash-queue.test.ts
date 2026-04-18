import { describe, expect, it } from "vitest";

import {
  buildKanjiClashCandidate,
  buildKanjiClashQueueSnapshot,
  materializeKanjiClashSessionRound,
  type KanjiClashEligibleSubject,
  type KanjiClashPairState
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
  input: Pick<KanjiClashPairState, "pairKey"> & Partial<KanjiClashPairState>
): KanjiClashPairState {
  return {
    createdAt: input.createdAt ?? "2026-04-08T08:00:00.000Z",
    difficulty: input.difficulty ?? 2.5,
    dueAt: input.dueAt ?? "2026-04-08T08:00:00.000Z",
    lapses: input.lapses ?? 0,
    lastInteractionAt: input.lastInteractionAt ?? "2026-04-08T08:00:00.000Z",
    lastReviewedAt: input.lastReviewedAt ?? "2026-04-08T08:00:00.000Z",
    learningSteps: input.learningSteps ?? 0,
    leftSubjectKey: input.leftSubjectKey ?? "left",
    pairKey: input.pairKey,
    reps: input.reps ?? 3,
    rightSubjectKey: input.rightSubjectKey ?? "right",
    scheduledDays: input.scheduledDays ?? 3,
    schedulerVersion: input.schedulerVersion ?? "kanji_clash_fsrs_v1",
    stability: input.stability ?? 8,
    state: input.state ?? "review",
    updatedAt: input.updatedAt ?? "2026-04-08T08:00:00.000Z"
  };
}

describe("kanji clash queue builder", () => {
  it("uses the remaining automatic new cap after counting introductions from today", () => {
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

    if (!dueCandidate) {
      throw new Error("Missing due candidate fixture.");
    }

    pairStates.set(
      dueCandidate.pairKey,
      makePairState({
        dueAt: "2026-04-08T08:00:00.000Z",
        leftSubjectKey: dueCandidate.leftSubjectKey,
        pairKey: dueCandidate.pairKey,
        rightSubjectKey: dueCandidate.rightSubjectKey,
        state: "review"
      })
    );

    const queue = buildKanjiClashQueueSnapshot({
      candidates,
      dailyNewLimit: 2,
      mode: "automatic",
      newIntroducedTodayCount: 1,
      now: "2026-04-09T10:00:00.000Z",
      pairStates,
      scope: "global",
      seenPairKeys: [
        candidates.find(
          (candidate) =>
            candidate.pairKey === "entry:term:alpha::entry:term:delta"
        )?.pairKey ?? ""
      ]
    });

    expect(queue.dueCount).toBe(1);
    expect(queue.newAvailableCount).toBeGreaterThanOrEqual(2);
    expect(queue.newQueuedCount).toBe(1);
    expect(queue.totalCount).toBe(2);
    expect(queue.rounds[0]?.pairKey).toBe(dueCandidate.pairKey);
    expect(new Set(queue.rounds.map((round) => round.pairKey)).size).toBe(
      queue.rounds.length
    );
    expect(
      queue.rounds.some(
        (round) => round.pairKey === "entry:term:alpha::entry:term:delta"
      )
    ).toBe(false);
  });

  it("dedupes seen pair keys and normalizes queue inputs before selection", () => {
    const alpha = makeSubject({
      kanji: ["食"],
      label: "食",
      reading: "しょく",
      subjectKey: "entry:term:alpha"
    });
    const beta = makeSubject({
      kanji: ["食"],
      label: "食品",
      reading: "しょくひん",
      subjectKey: "entry:term:beta"
    });
    const candidate = buildKanjiClashCandidate(alpha, beta);

    if (!candidate) {
      throw new Error("Missing queue normalization candidate fixture.");
    }

    const queue = buildKanjiClashQueueSnapshot({
      candidates: [candidate],
      currentRoundIndex: 3.9,
      mode: "manual",
      now: "2026-04-09T10:00:00.000Z",
      requestedSize: 1.9,
      scope: "global",
      seenPairKeys: ["skip", "skip", "other", "other"]
    });

    expect(queue.currentRoundIndex).toBe(1);
    expect(queue.requestedSize).toBe(1);
    expect(queue.remainingCount).toBe(0);
    expect(queue.seenPairKeys).toEqual(["skip", "other"]);
    expect(queue.totalCount).toBe(1);
  });

  it("builds a finite manual session and includes reserve pairs after due and new ones", () => {
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
    const dueCandidate = buildKanjiClashCandidate(alpha, beta);
    const reserveCandidate = buildKanjiClashCandidate(beta, gamma);

    if (!dueCandidate || !reserveCandidate) {
      throw new Error("Missing manual queue candidate fixtures.");
    }

    const pairStates = new Map<string, KanjiClashPairState>([
      [
        dueCandidate.pairKey,
        makePairState({
          dueAt: "2026-04-08T08:00:00.000Z",
          leftSubjectKey: dueCandidate.leftSubjectKey,
          pairKey: dueCandidate.pairKey,
          rightSubjectKey: dueCandidate.rightSubjectKey,
          state: "review"
        })
      ],
      [
        reserveCandidate.pairKey,
        makePairState({
          dueAt: "2026-04-12T08:00:00.000Z",
          leftSubjectKey: reserveCandidate.leftSubjectKey,
          pairKey: reserveCandidate.pairKey,
          rightSubjectKey: reserveCandidate.rightSubjectKey,
          state: "review"
        })
      ]
    ]);

    const queue = buildKanjiClashQueueSnapshot({
      candidates: [dueCandidate, reserveCandidate],
      mode: "manual",
      now: "2026-04-09T10:00:00.000Z",
      pairStates,
      requestedSize: 2,
      scope: "media"
    });

    expect(queue.totalCount).toBe(2);
    expect(queue.reserveCount).toBe(1);
    expect(queue.rounds.map((round) => round.source)).toEqual([
      "due",
      "reserve"
    ]);
  });

  it("materializes deterministic round sides and target placement", () => {
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
      throw new Error("Missing deterministic round candidate fixture.");
    }

    const first = materializeKanjiClashSessionRound(
      {
        candidate,
        pairState: null,
        source: "new"
      },
      0
    );
    const second = materializeKanjiClashSessionRound(
      {
        candidate,
        pairState: null,
        source: "new"
      },
      0
    );

    expect(first).toEqual(second);
    expect([first.leftSubjectKey, first.rightSubjectKey]).toContain(
      first.targetSubjectKey
    );
    expect(first.correctSubjectKey).toBe(first.targetSubjectKey);
  });

  it("keeps forced manual contrast rounds distinct even when they share a pair key", () => {
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
      throw new Error("Missing forced manual contrast candidate fixture.");
    }

    const contrastKey = candidate.pairKey;
    const subjectARoundKey = `${contrastKey}::subject_a`;
    const subjectBRoundKey = `${contrastKey}::subject_b`;
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
            roundKey: subjectARoundKey,
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
            roundKey: subjectBRoundKey,
            targetSubjectKey: beta.subjectKey
          }
        }
      ],
      mode: "manual",
      now: "2026-04-09T10:00:00.000Z",
      requestedSize: 2,
      scope: "global",
      seenRoundKeys: [subjectARoundKey]
    });

    expect(queue.seenRoundKeys).toEqual([subjectARoundKey]);
    expect(queue.totalCount).toBe(1);
    expect(queue.rounds[0]?.pairKey).toBe(contrastKey);
    expect(queue.rounds[0]?.roundKey).toBe(subjectBRoundKey);
    expect(queue.rounds[0]?.origin).toEqual({
      contrastKey,
      direction: "subject_b",
      type: "manual-contrast"
    });
    expect(queue.rounds[0]?.targetSubjectKey).toBe(beta.subjectKey);
  });
});
