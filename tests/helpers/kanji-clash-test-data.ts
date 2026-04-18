import type {
  KanjiClashEligibleSubject,
  KanjiClashPageData,
  KanjiClashPairState,
  KanjiClashQueueSnapshot,
  KanjiClashSessionActionResult,
  KanjiClashSessionRound
} from "@/lib/kanji-clash/types";

type BuildSubjectOverrides = Partial<KanjiClashEligibleSubject> & {
  kanji?: string[];
  label?: string;
  meaningIt?: string;
  reading?: string;
  subjectKey?: string;
};

type BuildRoundOverrides = Partial<KanjiClashSessionRound> & {
  left?: KanjiClashEligibleSubject;
  pairKey?: string;
  right?: KanjiClashEligibleSubject;
  roundKey?: string;
  targetPlacement?: "left" | "right";
};

type BuildPageDataOverrides = {
  availableMedia?: KanjiClashPageData["availableMedia"];
  currentRound?: KanjiClashPageData["currentRound"];
  manualContrasts?: KanjiClashPageData["manualContrasts"];
  mode?: KanjiClashPageData["mode"];
  queue?: Partial<KanjiClashPageData["queue"]>;
  selectedMedia?: KanjiClashPageData["selectedMedia"];
  settings?: Partial<KanjiClashPageData["settings"]>;
};

export function buildKanjiClashSubject(
  overrides: BuildSubjectOverrides = {}
): KanjiClashEligibleSubject {
  const label = overrides.label ?? "食費";
  const meaningIt = overrides.meaningIt ?? "spese per il cibo";
  const reading = overrides.reading ?? "しょくひ";
  const subjectKey = overrides.subjectKey ?? "entry:term:term-alpha-shokuhi";
  const entryId = subjectKey.replace("entry:term:", "");

  return {
    entryType: "term",
    kanji: overrides.kanji ?? [label],
    label,
    members: [
      {
        entryId,
        lemma: label,
        meaningIt,
        mediaId: "media-alpha",
        mediaSlug: "alpha",
        mediaTitle: "Alpha",
        reading
      }
    ],
    reading,
    readingForms: [reading],
    reps: 1,
    reviewState: "review",
    source: {
      entryId,
      type: "entry"
    },
    stability: 1,
    subjectKey,
    surfaceForms: [label],
    ...overrides
  };
}

export function buildKanjiClashRound(
  overrides: BuildRoundOverrides = {}
): KanjiClashSessionRound {
  const left =
    overrides.left ??
    buildKanjiClashSubject({
      kanji: ["食", "費"],
      label: "食費",
      meaningIt: "spese per il cibo",
      reading: "しょくひ",
      subjectKey: "entry:term:term-alpha-shokuhi"
    });
  const right =
    overrides.right ??
    buildKanjiClashSubject({
      kanji: ["食", "品"],
      label: "食品",
      meaningIt: "alimento",
      reading: "しょくひん",
      subjectKey: "entry:term:term-alpha-shokuhin"
    });
  const pairKey = overrides.pairKey ?? "pair-alpha";
  const roundKey = overrides.roundKey ?? pairKey;
  const targetPlacement = overrides.targetPlacement ?? "left";
  const target = targetPlacement === "left" ? left : right;

  return {
    candidate: {
      left,
      leftSubjectKey: left.subjectKey,
      pairKey,
      pairReasons: ["shared-kanji"],
      right,
      rightSubjectKey: right.subjectKey,
      score: 120,
      sharedKanji: ["食"],
      similarKanjiSwaps: []
    },
    correctSubjectKey: target.subjectKey,
    left,
    leftSubjectKey: left.subjectKey,
    origin: overrides.origin ?? {
      type: "pair"
    },
    pairKey,
    pairState: null,
    right,
    rightSubjectKey: right.subjectKey,
    roundKey,
    source: "due",
    target,
    targetPlacement,
    targetSubjectKey: target.subjectKey,
    ...overrides
  };
}

export function buildKanjiClashQueue(
  currentRoundIndex = 0,
  overrides: Partial<KanjiClashQueueSnapshot> = {}
): KanjiClashQueueSnapshot {
  const rounds = overrides.rounds ?? [
    buildKanjiClashRound({
      left: buildKanjiClashSubject({
        label: "左",
        reading: "ひだり-reading",
        subjectKey: "subject-1"
      }),
      pairKey: "pair-1",
      right: buildKanjiClashSubject({
        label: "右",
        reading: "みぎ-reading",
        subjectKey: "subject-2"
      }),
      targetPlacement: "left"
    }),
    buildKanjiClashRound({
      left: buildKanjiClashSubject({
        label: "前",
        reading: "まえ-reading",
        subjectKey: "subject-3"
      }),
      pairKey: "pair-2",
      right: buildKanjiClashSubject({
        label: "後",
        reading: "あと-reading",
        subjectKey: "subject-4"
      }),
      targetPlacement: "left"
    })
  ];

  return {
    awaitingConfirmation: false,
    currentRoundIndex,
    dailyNewLimit: 5,
    dueCount: rounds.length,
    finished: currentRoundIndex >= rounds.length,
    introducedTodayCount: 0,
    mode: "manual",
    newAvailableCount: 0,
    newQueuedCount: 0,
    remainingCount: Math.max(0, rounds.length - currentRoundIndex),
    requestedSize: 20,
    reserveCount: 0,
    rounds,
    snapshotAtIso: "2026-04-09T12:00:00.000Z",
    scope: "global",
    seenPairKeys: [],
    seenRoundKeys: [],
    totalCount: rounds.length,
    ...overrides
  };
}

export function buildKanjiClashPageData(
  overrides: BuildPageDataOverrides = {}
): KanjiClashPageData {
  const selectedMedia = overrides.selectedMedia ?? null;
  const mode = overrides.mode ?? "automatic";
  const scope = selectedMedia ? "media" : "global";
  const currentRound = Object.prototype.hasOwnProperty.call(
    overrides,
    "currentRound"
  )
    ? overrides.currentRound
    : buildKanjiClashRound();
  const rounds = currentRound ? [currentRound] : [];
  const queue = {
    ...buildKanjiClashQueue(0, {
      dueCount: 1,
      introducedTodayCount: 1,
      mode,
      newAvailableCount: 2,
      newQueuedCount: 1,
      remainingCount: 3,
      requestedSize: null,
      rounds,
      scope,
      totalCount: 1
    }),
    ...(overrides.queue ?? {})
  } satisfies KanjiClashPageData["queue"];

  return {
    availableMedia: overrides.availableMedia ?? [
      { id: "media-alpha", slug: "alpha", title: "Alpha" },
      { id: "media-beta", slug: "beta", title: "Beta" }
    ],
    currentRound: currentRound as KanjiClashPageData["currentRound"],
    manualContrasts: overrides.manualContrasts ?? [],
    mode,
    queue,
    queueToken: "test-kanji-clash-queue-token",
    scope,
    selectedMedia,
    settings: {
      dailyNewLimit: 5,
      defaultScope: "global",
      manualDefaultSize: 20,
      manualSizeOptions: [10, 20, 40],
      ...(overrides.settings ?? {})
    },
    snapshotAtIso: "2026-04-09T12:00:00.000Z"
  };
}

export function buildKanjiClashSessionActionResult(
  input: {
    isCorrect?: boolean;
    nextQueue?: KanjiClashQueueSnapshot;
    nextRound?: KanjiClashSessionRound | null;
  } = {}
): KanjiClashSessionActionResult {
  const isCorrect = input.isCorrect ?? true;
  const answeredRound = buildKanjiClashRound({
    left: buildKanjiClashSubject({
      label: "左",
      reading: "ひだり-reading",
      subjectKey: "subject-1"
    }),
    pairKey: "pair-1",
    right: buildKanjiClashSubject({
      label: "右",
      reading: "みぎ-reading",
      subjectKey: "subject-2"
    }),
    targetPlacement: "left"
  });
  const nextRound =
    input.nextRound ??
    buildKanjiClashRound({
      left: buildKanjiClashSubject({
        label: "前",
        reading: "まえ-reading",
        subjectKey: "subject-3"
      }),
      pairKey: "pair-2",
      right: buildKanjiClashSubject({
        label: "後",
        reading: "あと-reading",
        subjectKey: "subject-4"
      }),
      targetPlacement: "left"
    });

  return {
    answeredRound,
    isCorrect,
    logId: "log-1",
    nextQueue: input.nextQueue ?? buildKanjiClashQueue(1),
    nextQueueToken: "token-2",
    nextRound: isCorrect ? nextRound : null,
    pairState: buildKanjiClashPairState("subject-1", "subject-2"),
    previousPairState: {
      difficulty: 1,
      dueAt: null,
      lapses: 0,
      lastInteractionAt: "2026-04-09T12:00:00.000Z",
      lastReviewedAt: null,
      learningSteps: 0,
      leftSubjectKey: "subject-1",
      pairKey: "pair-1",
      reps: 0,
      rightSubjectKey: "subject-2",
      scheduledDays: 0,
      schedulerVersion: "kanji_clash_fsrs_v1",
      stability: null,
      state: "new"
    },
    result: isCorrect ? "good" : "again",
    scheduled: {
      difficulty: 2,
      dueAt: "2026-04-10T12:00:00.000Z",
      elapsedDays: 0,
      lapses: 0,
      learningSteps: 0,
      reps: 1,
      scheduledDays: 1,
      schedulerVersion: "kanji_clash_fsrs_v1",
      stability: 1,
      state: "review"
    },
    selectedSubjectKey: isCorrect ? "subject-1" : "subject-2"
  };
}

function buildKanjiClashPairState(
  leftSubjectKey: string,
  rightSubjectKey: string
): KanjiClashPairState {
  return {
    createdAt: "2026-04-09T12:00:00.000Z",
    difficulty: 2,
    dueAt: "2026-04-10T12:00:00.000Z",
    lapses: 0,
    lastInteractionAt: "2026-04-09T12:00:00.000Z",
    lastReviewedAt: "2026-04-09T12:00:00.000Z",
    learningSteps: 0,
    leftSubjectKey,
    pairKey: "pair-1",
    reps: 1,
    rightSubjectKey,
    scheduledDays: 1,
    schedulerVersion: "kanji_clash_fsrs_v1",
    stability: 1,
    state: "review",
    updatedAt: "2026-04-09T12:00:00.000Z"
  };
}
