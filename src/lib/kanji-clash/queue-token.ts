import { createHmac, timingSafeEqual } from "node:crypto";

import { materializeKanjiClashSessionRound } from "./queue.ts";
import { buildKanjiClashPairKey } from "./utils.ts";
import type {
  KanjiClashEligibleSubject,
  KanjiClashPairReason,
  KanjiClashPairState,
  KanjiClashSimilarKanjiSwap,
  KanjiClashQueueSnapshot,
  KanjiClashRoundSource,
  KanjiClashSessionRound
} from "./types.ts";

const KANJI_CLASH_QUEUE_TOKEN_VERSION_V1 = 1;
const KANJI_CLASH_QUEUE_TOKEN_VERSION_V2 = 2;
const KANJI_CLASH_QUEUE_TOKEN_VERSION_V3 = 3;
const KANJI_CLASH_QUEUE_TOKEN_VERSION_V4 = 4;
const KANJI_CLASH_ROUND_SOURCE_CODES = {
  due: 0,
  new: 1,
  reserve: 2
} as const;
const KANJI_CLASH_ROUND_ORIGIN_CODES = {
  "manual-contrast": 1,
  pair: 0
} as const;
const KANJI_CLASH_MANUAL_CONTRAST_DIRECTION_CODES = {
  subject_a: 0,
  subject_b: 1
} as const;

type KanjiClashLegacyQueueTokenPayload = {
  queue: KanjiClashQueueSnapshot;
  version: typeof KANJI_CLASH_QUEUE_TOKEN_VERSION_V1;
};

type CompactKanjiClashPairState = Omit<
  KanjiClashPairState,
  "leftSubjectKey" | "pairKey" | "rightSubjectKey"
>;

type CompactKanjiClashRoundPayload = {
  k: string[];
  p: CompactKanjiClashPairState | null;
  s: readonly [number, number];
  score: number;
  src: (typeof KANJI_CLASH_ROUND_SOURCE_CODES)[keyof typeof KANJI_CLASH_ROUND_SOURCE_CODES];
};

type CompactKanjiClashSimilarSwapPayload = readonly [
  string,
  string,
  number,
  number
];

type CompactKanjiClashQueueTokenPayload = {
  queue: {
    a: boolean;
    c: number;
    d: number | null;
    i: number;
    m: KanjiClashQueueSnapshot["mode"];
    n: number;
    q: CompactKanjiClashRoundPayload[];
    r: number | null;
    s: string[];
    scope: KanjiClashQueueSnapshot["scope"];
    t: string;
    u: KanjiClashEligibleSubject[];
  };
  version: typeof KANJI_CLASH_QUEUE_TOKEN_VERSION_V2;
};

type CompactKanjiClashRoundPayloadV3 = {
  k: string[];
  p: CompactKanjiClashPairState | null;
  pr: KanjiClashPairReason[];
  s: readonly [number, number];
  score: number;
  sk: CompactKanjiClashSimilarSwapPayload[];
  src: (typeof KANJI_CLASH_ROUND_SOURCE_CODES)[keyof typeof KANJI_CLASH_ROUND_SOURCE_CODES];
};

type CompactKanjiClashRoundOriginPayload =
  | readonly [0]
  | readonly [1, string, 0 | 1];

type CompactKanjiClashQueueTokenPayloadV3 = {
  queue: {
    a: boolean;
    c: number;
    d: number | null;
    i: number;
    m: KanjiClashQueueSnapshot["mode"];
    n: number;
    q: CompactKanjiClashRoundPayloadV3[];
    r: number | null;
    s: string[];
    scope: KanjiClashQueueSnapshot["scope"];
    t: string;
    u: KanjiClashEligibleSubject[];
  };
  version: typeof KANJI_CLASH_QUEUE_TOKEN_VERSION_V3;
};

type CompactKanjiClashRoundPayloadV4 = {
  k: string[];
  p: CompactKanjiClashPairState | null;
  pr: KanjiClashPairReason[];
  rk: string;
  ro: CompactKanjiClashRoundOriginPayload;
  rt: number;
  s: readonly [number, number];
  score: number;
  sk: CompactKanjiClashSimilarSwapPayload[];
  src: (typeof KANJI_CLASH_ROUND_SOURCE_CODES)[keyof typeof KANJI_CLASH_ROUND_SOURCE_CODES];
};

type CompactKanjiClashQueueTokenPayloadV4 = {
  queue: {
    a: boolean;
    c: number;
    d: number | null;
    i: number;
    m: KanjiClashQueueSnapshot["mode"];
    n: number;
    q: CompactKanjiClashRoundPayloadV4[];
    r: number | null;
    s: string[];
    scope: KanjiClashQueueSnapshot["scope"];
    sr: string[];
    t: string;
    u: KanjiClashEligibleSubject[];
  };
  version: typeof KANJI_CLASH_QUEUE_TOKEN_VERSION_V4;
};

export function createKanjiClashQueueToken(queue: KanjiClashQueueSnapshot) {
  const payload = JSON.stringify(
    serializeKanjiClashQueueTokenPayloadV4(
      queue
    ) satisfies CompactKanjiClashQueueTokenPayloadV4
  );
  const encodedPayload = toBase64Url(payload);
  const signature = signKanjiClashQueueTokenPayload(
    encodedPayload,
    getKanjiClashQueueTokenSecret()
  );

  return `${encodedPayload}.${signature}`;
}

export function verifyKanjiClashQueueToken(token: string) {
  const tokenParts = token.split(".");

  if (tokenParts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = tokenParts;

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signKanjiClashQueueTokenPayload(
    encodedPayload,
    getKanjiClashQueueTokenSecret()
  );

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as Partial<
      | CompactKanjiClashQueueTokenPayloadV4
      | CompactKanjiClashQueueTokenPayloadV3
      | CompactKanjiClashQueueTokenPayload
      | KanjiClashLegacyQueueTokenPayload
    >;

    if (payload.version === KANJI_CLASH_QUEUE_TOKEN_VERSION_V4) {
      return inflateKanjiClashQueueTokenPayloadV4(payload);
    }

    if (payload.version === KANJI_CLASH_QUEUE_TOKEN_VERSION_V3) {
      return inflateKanjiClashQueueTokenPayloadV3(payload);
    }

    if (payload.version === KANJI_CLASH_QUEUE_TOKEN_VERSION_V2) {
      return inflateKanjiClashQueueTokenPayloadV2(payload);
    }

    if (
      payload.version === KANJI_CLASH_QUEUE_TOKEN_VERSION_V1 &&
      isKanjiClashQueueSnapshot(payload.queue)
    ) {
      return normalizeLegacyKanjiClashQueueSnapshot(payload.queue);
    }

    return null;
  } catch {
    return null;
  }
}

function getKanjiClashQueueTokenSecret() {
  const configuredSecret = process.env.AUTH_SESSION_SECRET?.trim() ?? "";

  if (configuredSecret.length > 0) {
    return configuredSecret;
  }

  // Keep page->action round trips stable even when auth is disabled and the app
  // is restarted between render and submit. This fallback is deterministic for
  // the local workspace, so it preserves integrity checks against accidental
  // corruption, but it is not meant to be a security boundary.
  return `jcs-kanji-clash:${process.cwd()}`;
}

function signKanjiClashQueueTokenPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function serializeKanjiClashQueueTokenPayloadV4(
  queue: KanjiClashQueueSnapshot
): CompactKanjiClashQueueTokenPayloadV4 {
  const { subjects, subjectIndexByKey } = buildSubjectRegistry(queue.rounds);

  return {
    queue: {
      a: queue.awaitingConfirmation,
      c: queue.currentRoundIndex,
      d: queue.dailyNewLimit,
      i: queue.introducedTodayCount,
      m: queue.mode,
      n: queue.newAvailableCount,
      q: queue.rounds.map((round) => ({
        k: round.candidate.sharedKanji,
        p: round.pairState ? compactKanjiClashPairState(round.pairState) : null,
        pr: round.candidate.pairReasons,
        rk: round.roundKey,
        ro: compactKanjiClashRoundOrigin(round.origin),
        rt: requireSubjectIndex(subjectIndexByKey, round.targetSubjectKey),
        s: [
          requireSubjectIndex(
            subjectIndexByKey,
            round.candidate.leftSubjectKey
          ),
          requireSubjectIndex(
            subjectIndexByKey,
            round.candidate.rightSubjectKey
          )
        ],
        score: round.candidate.score,
        sk: round.candidate.similarKanjiSwaps.map((swap) => [
          swap.leftKanji,
          swap.rightKanji,
          swap.position,
          swap.confidence
        ]),
        src: KANJI_CLASH_ROUND_SOURCE_CODES[round.source]
      })),
      r: queue.requestedSize,
      s: queue.seenPairKeys,
      scope: queue.scope,
      sr: queue.seenRoundKeys,
      t: queue.snapshotAtIso,
      u: subjects
    },
    version: KANJI_CLASH_QUEUE_TOKEN_VERSION_V4
  };
}

function inflateKanjiClashQueueTokenPayloadV4(
  payload: Partial<CompactKanjiClashQueueTokenPayloadV4>
) {
  if (!isCompactKanjiClashQueueTokenPayloadV4(payload)) {
    return null;
  }

  const subjects = payload.queue.u;
  const rounds = payload.queue.q.map((round, index) => {
    const left = subjects[round.s[0]];
    const right = subjects[round.s[1]];
    const target = subjects[round.rt];

    if (!left || !right || !target) {
      throw new Error("Kanji Clash queue token references a missing subject.");
    }

    const pairKey = buildKanjiClashPairKey(left.subjectKey, right.subjectKey);
    const pairState = round.p
      ? inflateKanjiClashPairState(round.p, {
          leftSubjectKey: left.subjectKey,
          pairKey,
          rightSubjectKey: right.subjectKey
        })
      : null;
    const origin = inflateKanjiClashRoundOriginPayload(round.ro);

    return materializeKanjiClashSessionRound(
      {
        candidate: {
          left,
          leftSubjectKey: left.subjectKey,
          pairKey,
          pairReasons: round.pr,
          right,
          rightSubjectKey: right.subjectKey,
          roundOverride:
            round.rk !== pairKey || origin.type !== "pair"
              ? {
                  origin,
                  roundKey: round.rk,
                  targetSubjectKey: target.subjectKey
                }
              : undefined,
          score: round.score,
          sharedKanji: round.k,
          similarKanjiSwaps: round.sk.map(inflateKanjiClashSimilarSwap)
        },
        pairState,
        source: inflateKanjiClashRoundSource(round.src)
      },
      index
    );
  });

  return buildQueueSnapshotFromInflatedRounds(payload.queue, rounds);
}

function inflateKanjiClashQueueTokenPayloadV3(
  payload: Partial<CompactKanjiClashQueueTokenPayloadV3>
) {
  if (!isCompactKanjiClashQueueTokenPayloadV3(payload)) {
    return null;
  }

  const subjects = payload.queue.u;
  const rounds = payload.queue.q.map((round, index) => {
    const left = subjects[round.s[0]];
    const right = subjects[round.s[1]];

    if (!left || !right) {
      throw new Error("Kanji Clash queue token references a missing subject.");
    }

    const pairKey = buildKanjiClashPairKey(left.subjectKey, right.subjectKey);
    const pairState = round.p
      ? inflateKanjiClashPairState(round.p, {
          leftSubjectKey: left.subjectKey,
          pairKey,
          rightSubjectKey: right.subjectKey
        })
      : null;

    return materializeKanjiClashSessionRound(
      {
        candidate: {
          left,
          leftSubjectKey: left.subjectKey,
          pairKey,
          pairReasons: round.pr,
          right,
          rightSubjectKey: right.subjectKey,
          score: round.score,
          sharedKanji: round.k,
          similarKanjiSwaps: round.sk.map(inflateKanjiClashSimilarSwap)
        },
        pairState,
        source: inflateKanjiClashRoundSource(round.src)
      },
      index
    );
  });

  return buildQueueSnapshotFromInflatedRounds(payload.queue, rounds);
}

function inflateKanjiClashQueueTokenPayloadV2(
  payload: Partial<CompactKanjiClashQueueTokenPayload>
) {
  if (!isCompactKanjiClashQueueTokenPayload(payload)) {
    return null;
  }

  const subjects = payload.queue.u;
  const rounds = payload.queue.q.map((round, index) => {
    const left = subjects[round.s[0]];
    const right = subjects[round.s[1]];

    if (!left || !right) {
      throw new Error("Kanji Clash queue token references a missing subject.");
    }

    const pairKey = buildKanjiClashPairKey(left.subjectKey, right.subjectKey);
    const pairState = round.p
      ? inflateKanjiClashPairState(round.p, {
          leftSubjectKey: left.subjectKey,
          pairKey,
          rightSubjectKey: right.subjectKey
        })
      : null;

    return materializeKanjiClashSessionRound(
      {
        candidate: {
          left,
          leftSubjectKey: left.subjectKey,
          pairKey,
          pairReasons: round.k.length > 0 ? ["shared-kanji"] : [],
          right,
          rightSubjectKey: right.subjectKey,
          score: round.score,
          sharedKanji: round.k,
          similarKanjiSwaps: []
        },
        pairState,
        source: inflateKanjiClashRoundSource(round.src)
      },
      index
    );
  });

  return buildQueueSnapshotFromInflatedRounds(payload.queue, rounds);
}

function buildQueueSnapshotFromInflatedRounds(
  queuePayload:
    | CompactKanjiClashQueueTokenPayload["queue"]
    | CompactKanjiClashQueueTokenPayloadV3["queue"]
    | CompactKanjiClashQueueTokenPayloadV4["queue"],
  rounds: KanjiClashSessionRound[]
) {
  const counts = countRoundSources(rounds);
  const currentRoundIndex = queuePayload.c;

  const queue = {
    awaitingConfirmation: queuePayload.a,
    currentRoundIndex,
    dailyNewLimit: queuePayload.d,
    dueCount: counts.due,
    finished: rounds.length === 0 || currentRoundIndex >= rounds.length,
    introducedTodayCount: queuePayload.i,
    mode: queuePayload.m,
    newAvailableCount: queuePayload.n,
    newQueuedCount: counts.new,
    remainingCount: Math.max(0, rounds.length - currentRoundIndex),
    requestedSize: queuePayload.r,
    reserveCount: counts.reserve,
    rounds,
    scope: queuePayload.scope,
    seenPairKeys: queuePayload.s,
    seenRoundKeys: "sr" in queuePayload ? queuePayload.sr : queuePayload.s,
    snapshotAtIso: queuePayload.t,
    totalCount: rounds.length
  } satisfies KanjiClashQueueSnapshot;

  return isKanjiClashQueueSnapshot(queue) ? queue : null;
}

function buildSubjectRegistry(rounds: KanjiClashSessionRound[]) {
  const subjects: KanjiClashEligibleSubject[] = [];
  const subjectIndexByKey = new Map<string, number>();

  for (const round of rounds) {
    registerSubject(subjectIndexByKey, subjects, round.candidate.left);
    registerSubject(subjectIndexByKey, subjects, round.candidate.right);
  }

  return {
    subjectIndexByKey,
    subjects
  };
}

function registerSubject(
  subjectIndexByKey: Map<string, number>,
  subjects: KanjiClashEligibleSubject[],
  subject: KanjiClashEligibleSubject
) {
  if (subjectIndexByKey.has(subject.subjectKey)) {
    return;
  }

  subjectIndexByKey.set(subject.subjectKey, subjects.length);
  subjects.push(subject);
}

function requireSubjectIndex(
  subjectIndexByKey: Map<string, number>,
  subjectKey: string
) {
  const index = subjectIndexByKey.get(subjectKey);

  if (typeof index !== "number") {
    throw new Error(`Missing Kanji Clash subject index for ${subjectKey}.`);
  }

  return index;
}

function compactKanjiClashPairState(
  pairState: KanjiClashPairState
): CompactKanjiClashPairState {
  return {
    createdAt: pairState.createdAt,
    difficulty: pairState.difficulty,
    dueAt: pairState.dueAt,
    lapses: pairState.lapses,
    lastInteractionAt: pairState.lastInteractionAt,
    lastReviewedAt: pairState.lastReviewedAt,
    learningSteps: pairState.learningSteps,
    reps: pairState.reps,
    scheduledDays: pairState.scheduledDays,
    schedulerVersion: pairState.schedulerVersion,
    stability: pairState.stability,
    state: pairState.state,
    updatedAt: pairState.updatedAt
  };
}

function inflateKanjiClashPairState(
  pairState: CompactKanjiClashPairState,
  identity: Pick<
    KanjiClashPairState,
    "leftSubjectKey" | "pairKey" | "rightSubjectKey"
  >
): KanjiClashPairState {
  return {
    ...pairState,
    ...identity
  };
}

function inflateKanjiClashRoundSource(
  source: CompactKanjiClashRoundPayload["src"]
): KanjiClashRoundSource {
  switch (source) {
    case KANJI_CLASH_ROUND_SOURCE_CODES.due:
      return "due";
    case KANJI_CLASH_ROUND_SOURCE_CODES.new:
      return "new";
    case KANJI_CLASH_ROUND_SOURCE_CODES.reserve:
      return "reserve";
    default:
      throw new Error(
        "Kanji Clash queue token contains an invalid round source."
      );
  }
}

function countRoundSources(rounds: KanjiClashSessionRound[]) {
  let due = 0;
  let reserve = 0;
  let queuedNew = 0;

  for (const round of rounds) {
    switch (round.source) {
      case "due":
        due += 1;
        break;
      case "new":
        queuedNew += 1;
        break;
      case "reserve":
        reserve += 1;
        break;
    }
  }

  return {
    due,
    new: queuedNew,
    reserve
  };
}

function compactKanjiClashRoundOrigin(
  origin: KanjiClashSessionRound["origin"]
): CompactKanjiClashRoundOriginPayload {
  if (origin.type === "pair") {
    return [KANJI_CLASH_ROUND_ORIGIN_CODES.pair];
  }

  return [
    KANJI_CLASH_ROUND_ORIGIN_CODES["manual-contrast"],
    origin.contrastKey,
    KANJI_CLASH_MANUAL_CONTRAST_DIRECTION_CODES[origin.direction]
  ];
}

function inflateKanjiClashRoundOriginPayload(
  origin: CompactKanjiClashRoundOriginPayload
): KanjiClashSessionRound["origin"] {
  if (origin[0] === KANJI_CLASH_ROUND_ORIGIN_CODES.pair) {
    return {
      type: "pair"
    };
  }

  return {
    contrastKey: origin[1],
    direction:
      origin[2] === KANJI_CLASH_MANUAL_CONTRAST_DIRECTION_CODES.subject_a
        ? "subject_a"
        : "subject_b",
    type: "manual-contrast"
  };
}

function isCompactKanjiClashQueueTokenPayload(
  value: Partial<CompactKanjiClashQueueTokenPayload>
): value is CompactKanjiClashQueueTokenPayload {
  return Boolean(
    value &&
    value.version === KANJI_CLASH_QUEUE_TOKEN_VERSION_V2 &&
    value.queue &&
    typeof value.queue === "object" &&
    Array.isArray(value.queue.q) &&
    Array.isArray(value.queue.s) &&
    Array.isArray(value.queue.u) &&
    typeof value.queue.m === "string" &&
    typeof value.queue.scope === "string" &&
    typeof value.queue.t === "string"
  );
}

function isCompactKanjiClashQueueTokenPayloadV3(
  value: Partial<CompactKanjiClashQueueTokenPayloadV3>
): value is CompactKanjiClashQueueTokenPayloadV3 {
  return Boolean(
    value &&
    value.version === KANJI_CLASH_QUEUE_TOKEN_VERSION_V3 &&
    value.queue &&
    typeof value.queue === "object" &&
    Array.isArray(value.queue.q) &&
    Array.isArray(value.queue.s) &&
    Array.isArray(value.queue.u) &&
    typeof value.queue.m === "string" &&
    typeof value.queue.scope === "string" &&
    typeof value.queue.t === "string"
  );
}

function isCompactKanjiClashQueueTokenPayloadV4(
  value: Partial<CompactKanjiClashQueueTokenPayloadV4>
): value is CompactKanjiClashQueueTokenPayloadV4 {
  return Boolean(
    value &&
    value.version === KANJI_CLASH_QUEUE_TOKEN_VERSION_V4 &&
    value.queue &&
    typeof value.queue === "object" &&
    Array.isArray(value.queue.q) &&
    Array.isArray(value.queue.s) &&
    Array.isArray(value.queue.sr) &&
    Array.isArray(value.queue.u) &&
    typeof value.queue.m === "string" &&
    typeof value.queue.scope === "string" &&
    typeof value.queue.t === "string"
  );
}

function isKanjiClashQueueSnapshot(
  value: unknown
): value is KanjiClashQueueSnapshot {
  return Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray((value as KanjiClashQueueSnapshot).rounds) &&
    Array.isArray((value as KanjiClashQueueSnapshot).seenPairKeys) &&
    typeof (value as KanjiClashQueueSnapshot).mode === "string" &&
    typeof (value as KanjiClashQueueSnapshot).scope === "string" &&
    typeof (value as KanjiClashQueueSnapshot).snapshotAtIso === "string"
  );
}

function inflateKanjiClashSimilarSwap(
  swap: CompactKanjiClashSimilarSwapPayload
): KanjiClashSimilarKanjiSwap {
  return {
    confidence: swap[3],
    leftKanji: swap[0],
    position: swap[2],
    rightKanji: swap[1]
  };
}

function normalizeLegacyKanjiClashQueueSnapshot(
  queue: KanjiClashQueueSnapshot
): KanjiClashQueueSnapshot {
  return {
    ...queue,
    rounds: queue.rounds.map((round) => ({
      ...round,
      origin: round.origin ?? {
        type: "pair"
      },
      roundKey: round.roundKey ?? round.pairKey,
      candidate: {
        ...round.candidate,
        pairReasons: Array.isArray(round.candidate.pairReasons)
          ? round.candidate.pairReasons
          : round.candidate.sharedKanji.length > 0
            ? ["shared-kanji"]
            : [],
        similarKanjiSwaps: Array.isArray(round.candidate.similarKanjiSwaps)
          ? round.candidate.similarKanjiSwaps
          : []
      }
    })),
    seenRoundKeys: Array.isArray(queue.seenRoundKeys)
      ? queue.seenRoundKeys
      : queue.seenPairKeys
  };
}
