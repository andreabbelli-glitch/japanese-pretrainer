import {
  createHmac,
  timingSafeEqual
} from "node:crypto";

import { materializeKanjiClashSessionRound } from "./queue.ts";
import { buildKanjiClashPairKey } from "./utils.ts";
import type {
  KanjiClashEligibleSubject,
  KanjiClashPairState,
  KanjiClashQueueSnapshot,
  KanjiClashRoundSource,
  KanjiClashSessionRound
} from "./types.ts";

const KANJI_CLASH_QUEUE_TOKEN_VERSION_V1 = 1;
const KANJI_CLASH_QUEUE_TOKEN_VERSION_V2 = 2;
const KANJI_CLASH_ROUND_SOURCE_CODES = {
  due: 0,
  new: 1,
  reserve: 2
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

export function createKanjiClashQueueToken(queue: KanjiClashQueueSnapshot) {
  const payload = JSON.stringify(
    serializeKanjiClashQueueTokenPayloadV2(queue) satisfies CompactKanjiClashQueueTokenPayload
  );
  const encodedPayload = toBase64Url(payload);
  const signature = signKanjiClashQueueTokenPayload(
    encodedPayload,
    getKanjiClashQueueTokenSecret()
  );

  return `${encodedPayload}.${signature}`;
}

export function verifyKanjiClashQueueToken(token: string) {
  const [encodedPayload, signature] = token.split(".");

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
      CompactKanjiClashQueueTokenPayload | KanjiClashLegacyQueueTokenPayload
    >;

    if (payload.version === KANJI_CLASH_QUEUE_TOKEN_VERSION_V2) {
      return inflateKanjiClashQueueTokenPayloadV2(payload);
    }

    if (
      payload.version === KANJI_CLASH_QUEUE_TOKEN_VERSION_V1 &&
      isKanjiClashQueueSnapshot(payload.queue)
    ) {
      return payload.queue;
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

function serializeKanjiClashQueueTokenPayloadV2(
  queue: KanjiClashQueueSnapshot
): CompactKanjiClashQueueTokenPayload {
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
        s: [
          requireSubjectIndex(subjectIndexByKey, round.candidate.leftSubjectKey),
          requireSubjectIndex(subjectIndexByKey, round.candidate.rightSubjectKey)
        ],
        score: round.candidate.score,
        src: KANJI_CLASH_ROUND_SOURCE_CODES[round.source]
      })),
      r: queue.requestedSize,
      s: queue.seenPairKeys,
      scope: queue.scope,
      t: queue.snapshotAtIso,
      u: subjects
    },
    version: KANJI_CLASH_QUEUE_TOKEN_VERSION_V2
  };
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
          right,
          rightSubjectKey: right.subjectKey,
          score: round.score,
          sharedKanji: round.k
        },
        pairState,
        source: inflateKanjiClashRoundSource(round.src)
      },
      index
    );
  });

  const counts = countRoundSources(rounds);
  const currentRoundIndex = payload.queue.c;

  const queue = {
    awaitingConfirmation: payload.queue.a,
    currentRoundIndex,
    dailyNewLimit: payload.queue.d,
    dueCount: counts.due,
    finished: rounds.length === 0 || currentRoundIndex >= rounds.length,
    introducedTodayCount: payload.queue.i,
    mode: payload.queue.m,
    newAvailableCount: payload.queue.n,
    newQueuedCount: counts.new,
    remainingCount: Math.max(0, rounds.length - currentRoundIndex),
    requestedSize: payload.queue.r,
    reserveCount: counts.reserve,
    rounds,
    scope: payload.queue.scope,
    seenPairKeys: payload.queue.s,
    snapshotAtIso: payload.queue.t,
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
      throw new Error("Kanji Clash queue token contains an invalid round source.");
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
