import {
  and,
  eq,
  inArray
} from "drizzle-orm";

import {
  card,
  grammarPattern,
  kanjiClashManualContrast,
  kanjiClashManualContrastRoundLog,
  kanjiClashManualContrastRoundState,
  media,
  term,
  type DatabaseClient,
  type EntryType
} from "@/db";

import type {
  KanjiClashCandidate,
  KanjiClashEligibleSubject,
  KanjiClashManualContrastDirection,
  KanjiClashManualContrastSummary,
  KanjiClashPairState
} from "./types.ts";
import {
  collectKanjiFromSurfaces,
  normalizeKanjiClashSurface
} from "./utils.ts";

type ManualContrastTransaction = Parameters<
  Parameters<DatabaseClient["transaction"]>[0]
>[0];

export type KanjiClashManualContrastSeed = {
  candidates: KanjiClashCandidate[];
  pairStates: Map<string, KanjiClashPairState>;
  suppressedContrastKeys: Set<string>;
};

type LoadedKanjiClashManualContrastRows = Awaited<
  ReturnType<typeof loadKanjiClashManualContrastRows>
>;
type LoadedKanjiClashManualContrastRowsWithRoundStates = Awaited<
  ReturnType<typeof loadKanjiClashManualContrastRowsWithRoundStates>
>;

export async function loadKanjiClashManualContrastPageSnapshot(input: {
  database: Pick<DatabaseClient, "query" | "select">;
  mediaIds?: string[];
}): Promise<{
  manualContrastSeed: KanjiClashManualContrastSeed;
  manualContrasts: KanjiClashManualContrastSummary[];
}> {
  const rows = await loadKanjiClashManualContrastRowsWithRoundStates(
    input.database
  );
  const subjectsByKey = await loadManualContrastSubjectMap({
    database: input.database,
    rows
  });

  return {
    manualContrastSeed: buildKanjiClashManualContrastSeed({
      mediaIds: input.mediaIds,
      rows,
      subjectsByKey
    }),
    manualContrasts: buildKanjiClashManualContrastSummaries(
      rows,
      subjectsByKey
    )
  };
}

export async function loadKanjiClashManualContrastCandidates(input: {
  database: Pick<DatabaseClient, "query" | "select">;
  mediaIds?: string[];
}): Promise<KanjiClashManualContrastSeed> {
  const rows = await loadKanjiClashManualContrastRowsWithRoundStates(
    input.database
  );
  const subjectsByKey = await loadManualContrastSubjectMap({
    database: input.database,
    rows
  });

  return buildKanjiClashManualContrastSeed({
    mediaIds: input.mediaIds,
    rows,
    subjectsByKey
  });
}

export async function listKanjiClashManualContrastSummaries(
  database: Pick<DatabaseClient, "query" | "select">
): Promise<KanjiClashManualContrastSummary[]> {
  const rows = await loadKanjiClashManualContrastRows(database);
  const subjectsByKey = await loadManualContrastSubjectMap({
    database,
    rows
  });

  return buildKanjiClashManualContrastSummaries(rows, subjectsByKey);
}

async function loadKanjiClashManualContrastRows(
  database: Pick<DatabaseClient, "query">
) {
  return database.query.kanjiClashManualContrast.findMany({
    orderBy: (fields, operators) => [
      operators.asc(fields.status),
      operators.desc(fields.updatedAt),
      operators.asc(fields.contrastKey)
    ]
  });
}

async function loadKanjiClashManualContrastRowsWithRoundStates(
  database: Pick<DatabaseClient, "query">
) {
  return database.query.kanjiClashManualContrast.findMany({
    orderBy: (fields, operators) => [
      operators.asc(fields.status),
      operators.desc(fields.updatedAt),
      operators.asc(fields.contrastKey)
    ],
    where: inArray(kanjiClashManualContrast.status, ["active", "archived"]),
    with: {
      roundStates: true
    }
  });
}

async function loadManualContrastSubjectMap(input: {
  database: Pick<DatabaseClient, "query" | "select">;
  rows: Array<{
    subjectAKey: string;
    subjectBKey: string;
  }>;
}) {
  return loadManualContrastSubjects({
    database: input.database,
    subjectKeys: dedupeStable(
      input.rows.flatMap((row) => [row.subjectAKey, row.subjectBKey])
    )
  });
}

function buildKanjiClashManualContrastSummaries(
  rows: LoadedKanjiClashManualContrastRows,
  subjectsByKey: Map<string, KanjiClashEligibleSubject>
) {
  return rows.map((row) => ({
    contrastKey: row.contrastKey,
    leftLabel:
      subjectsByKey.get(row.subjectAKey)?.label ??
      formatManualContrastSubjectLabel(row.subjectAKey),
    leftSubjectKey: row.subjectAKey,
    rightLabel:
      subjectsByKey.get(row.subjectBKey)?.label ??
      formatManualContrastSubjectLabel(row.subjectBKey),
    rightSubjectKey: row.subjectBKey,
    source: row.source,
    status: row.status
  }));
}

function buildKanjiClashManualContrastSeed(input: {
  mediaIds?: string[];
  rows: LoadedKanjiClashManualContrastRowsWithRoundStates;
  subjectsByKey: Map<string, KanjiClashEligibleSubject>;
}): KanjiClashManualContrastSeed {
  const candidates: KanjiClashCandidate[] = [];
  const pairStates = new Map<string, KanjiClashPairState>();
  const suppressedContrastKeys = new Set<string>();

  for (const contrast of input.rows) {
    suppressedContrastKeys.add(contrast.contrastKey);

    if (contrast.status !== "active") {
      continue;
    }

    const left = input.subjectsByKey.get(contrast.subjectAKey);
    const right = input.subjectsByKey.get(contrast.subjectBKey);

    if (!left || !right) {
      continue;
    }

    if (
      input.mediaIds &&
      !subjectMatchesMediaFilter(left, input.mediaIds) &&
      !subjectMatchesMediaFilter(right, input.mediaIds)
    ) {
      continue;
    }

    for (const roundState of contrast.roundStates) {
      candidates.push({
        left,
        leftSubjectKey: left.subjectKey,
        pairKey: contrast.contrastKey,
        pairReasons: [],
        right,
        rightSubjectKey: right.subjectKey,
        roundOverride: {
          origin: {
            contrastKey: contrast.contrastKey,
            direction: roundState.direction,
            type: "manual-contrast"
          },
          roundKey: roundState.roundKey,
          targetSubjectKey: roundState.targetSubjectKey
        },
        score: buildManualContrastScore(contrast),
        sharedKanji: [],
        similarKanjiSwaps: []
      });
      pairStates.set(
        roundState.roundKey,
        mapManualContrastRoundStateToPairState(roundState)
      );
    }
  }

  return {
    candidates,
    pairStates,
    suppressedContrastKeys
  };
}

export async function archiveKanjiClashManualContrast(input: {
  contrastKey: string;
  database?: DatabaseClient;
  now?: Date;
}) {
  const database = input.database;

  if (!database) {
    throw new Error("Missing database client.");
  }

  const nowIso = (input.now ?? new Date()).toISOString();
  const [updated] = await database
    .update(kanjiClashManualContrast)
    .set({
      status: "archived",
      updatedAt: nowIso
    })
    .where(eq(kanjiClashManualContrast.contrastKey, input.contrastKey))
    .returning({
      contrastKey: kanjiClashManualContrast.contrastKey
    });

  if (!updated) {
    throw new Error("Il contrasto manuale non è più disponibile.");
  }
}

export async function restoreKanjiClashManualContrast(input: {
  contrastKey: string;
  database?: DatabaseClient;
  now?: Date;
}) {
  const database = input.database;

  if (!database) {
    throw new Error("Missing database client.");
  }

  const nowIso = (input.now ?? new Date()).toISOString();

  await database.transaction(async (tx) => {
    const [updated] = await tx
      .update(kanjiClashManualContrast)
      .set({
        forcedDueAt: nowIso,
        lastForcedAt: nowIso,
        status: "active",
        updatedAt: nowIso
      })
      .where(eq(kanjiClashManualContrast.contrastKey, input.contrastKey))
      .returning({
        contrastKey: kanjiClashManualContrast.contrastKey
      });

    if (!updated) {
      throw new Error("Il contrasto manuale non è più disponibile.");
    }

    await tx
      .update(kanjiClashManualContrastRoundState)
      .set({
        dueAt: nowIso,
        lastInteractionAt: nowIso,
        updatedAt: nowIso
      })
      .where(eq(kanjiClashManualContrastRoundState.contrastKey, input.contrastKey));
  });
}

export async function applyKanjiClashManualContrastRoundAnswer(input: {
  chosenSubjectKey: string;
  contrastKey: string;
  currentRound: {
    correctSubjectKey: string;
    leftSubjectKey: string;
    pairKey: string;
    rightSubjectKey: string;
    roundKey: string;
    targetSubjectKey: string;
  };
  expectedUpdatedAt?: string | null;
  now: Date;
  responseMs?: number | null;
  result: "again" | "good";
  scheduled: {
    difficulty: number;
    dueAt: string;
    elapsedDays: number | null;
    lapses: number;
    learningSteps: number;
    reps: number;
    scheduledDays: number;
    schedulerVersion: "kanji_clash_fsrs_v1";
    stability: number;
    state: KanjiClashPairState["state"];
  };
  transition: {
    next: KanjiClashPairState;
    previous: Omit<KanjiClashPairState, "createdAt" | "updatedAt" | "pairKey">;
  };
  transaction: ManualContrastTransaction;
}) {
  const archivedContrastError =
    "Questo contrasto manuale è stato archiviato. Aggiorna Kanji Clash per continuare.";
  const roundState =
    await input.transaction.query.kanjiClashManualContrastRoundState.findFirst({
      where: eq(kanjiClashManualContrastRoundState.roundKey, input.currentRound.roundKey)
    });

  if (!roundState) {
    throw new Error("Kanji Clash round is out of date.");
  }

  if (roundState.contrastKey !== input.contrastKey) {
    throw new Error("Kanji Clash round is out of date.");
  }

  if (
    input.expectedUpdatedAt &&
    roundState.updatedAt !== input.expectedUpdatedAt
  ) {
    throw new Error("Kanji Clash round is out of date.");
  }

  const contrast = await input.transaction.query.kanjiClashManualContrast.findFirst({
    where: eq(kanjiClashManualContrast.contrastKey, input.contrastKey)
  });

  if (!contrast) {
    throw new Error("Kanji Clash round is out of date.");
  }

  if (contrast.status !== "active") {
    throw new Error(archivedContrastError);
  }

  const logId = `kanji_clash_manual_contrast_log_${crypto.randomUUID()}`;

  const [activeContrast] = await input.transaction
    .update(kanjiClashManualContrast)
    .set({
      forcedDueAt: null,
      updatedAt: input.now.toISOString()
    })
    .where(
      and(
        eq(kanjiClashManualContrast.contrastKey, input.contrastKey),
        eq(kanjiClashManualContrast.status, "active")
      )
    )
    .returning({
      contrastKey: kanjiClashManualContrast.contrastKey
    });

  if (!activeContrast) {
    throw new Error(archivedContrastError);
  }

  await input.transaction
    .update(kanjiClashManualContrastRoundState)
    .set({
      difficulty: input.transition.next.difficulty,
      dueAt: input.transition.next.dueAt,
      lapses: input.transition.next.lapses,
      lastInteractionAt: input.now.toISOString(),
      lastReviewedAt: input.now.toISOString(),
      learningSteps: input.transition.next.learningSteps,
      reps: input.transition.next.reps,
      scheduledDays: input.transition.next.scheduledDays,
      stability: input.transition.next.stability,
      state: input.transition.next.state,
      updatedAt: input.now.toISOString()
    })
    .where(eq(kanjiClashManualContrastRoundState.roundKey, input.currentRound.roundKey));

  await input.transaction.insert(kanjiClashManualContrastRoundLog).values({
    answeredAt: input.now.toISOString(),
    chosenSubjectKey: input.chosenSubjectKey,
    contrastKey: input.contrastKey,
    correctSubjectKey: input.currentRound.correctSubjectKey,
    direction: getManualContrastDirectionFromRoundKey(input.currentRound.roundKey),
    elapsedDays: input.scheduled.elapsedDays,
    id: logId,
    leftSubjectKey: input.currentRound.leftSubjectKey,
    newState: input.transition.next.state,
    previousState: input.transition.previous.state,
    responseMs: input.responseMs ?? null,
    result: input.result,
    rightSubjectKey: input.currentRound.rightSubjectKey,
    roundKey: input.currentRound.roundKey,
    scheduledDueAt: input.scheduled.dueAt,
    schedulerVersion: "kanji_clash_manual_contrast_fsrs_v1",
    targetSubjectKey: input.currentRound.targetSubjectKey
  });

  return logId;
}

export function mapManualContrastRoundStateToPairState(
  roundState: typeof kanjiClashManualContrastRoundState.$inferSelect
): KanjiClashPairState {
  return {
    createdAt: roundState.createdAt,
    difficulty: roundState.difficulty,
    dueAt: roundState.dueAt,
    lapses: roundState.lapses,
    lastInteractionAt: roundState.lastInteractionAt,
    lastReviewedAt: roundState.lastReviewedAt,
    learningSteps: roundState.learningSteps,
    leftSubjectKey: roundState.leftSubjectKey,
    pairKey: roundState.contrastKey,
    reps: roundState.reps,
    rightSubjectKey: roundState.rightSubjectKey,
    scheduledDays: roundState.scheduledDays,
    schedulerVersion: "kanji_clash_fsrs_v1",
    stability: roundState.stability,
    state: roundState.state,
    updatedAt: roundState.updatedAt
  };
}

export function formatManualContrastSubjectLabel(subjectKey: string) {
  const [, maybeEntryType, rawId] = subjectKey.split(":");

  if (subjectKey.startsWith("card:")) {
    return rawId ?? subjectKey;
  }

  if (subjectKey.startsWith("entry:") || subjectKey.startsWith("group:")) {
    return rawId ?? maybeEntryType ?? subjectKey;
  }

  return subjectKey;
}

function getManualContrastDirectionFromRoundKey(
  roundKey: string
): KanjiClashManualContrastDirection {
  return roundKey.endsWith("::subject_b") ? "subject_b" : "subject_a";
}

async function loadManualContrastSubjects(input: {
  database: Pick<DatabaseClient, "query" | "select">;
  subjectKeys: string[];
}) {
  const parsedKeys = input.subjectKeys.map(parseManualContrastSubjectKey);
  const termEntryIds = parsedKeys
    .filter(
      (parsed): parsed is { entryId: string; entryType: "term"; kind: "entry" } =>
        parsed?.kind === "entry" && parsed.entryType === "term"
    )
    .map((parsed) => parsed.entryId);
  const grammarEntryIds = parsedKeys
    .filter(
      (
        parsed
      ): parsed is { entryId: string; entryType: "grammar"; kind: "entry" } =>
        parsed?.kind === "entry" && parsed.entryType === "grammar"
    )
    .map((parsed) => parsed.entryId);
  const termGroupIds = parsedKeys
    .filter(
      (
        parsed
      ): parsed is {
        crossMediaGroupId: string;
        entryType: "term";
        kind: "group";
      } => parsed?.kind === "group" && parsed.entryType === "term"
    )
    .map((parsed) => parsed.crossMediaGroupId);
  const grammarGroupIds = parsedKeys
    .filter(
      (
        parsed
      ): parsed is {
        crossMediaGroupId: string;
        entryType: "grammar";
        kind: "group";
      } => parsed?.kind === "group" && parsed.entryType === "grammar"
    )
    .map((parsed) => parsed.crossMediaGroupId);
  const cardIds = parsedKeys
    .filter(
      (parsed): parsed is { cardId: string; kind: "card" } =>
        parsed?.kind === "card"
    )
    .map((parsed) => parsed.cardId);
  const subjects = new Map<string, KanjiClashEligibleSubject>();
  const [
    termRows,
    grammarRows,
    termGroupRows,
    grammarGroupRows,
    cardRows
  ] = await Promise.all([
    termEntryIds.length === 0
      ? Promise.resolve([])
      : input.database
          .select({
            entryId: term.id,
            label: term.lemma,
            meaningIt: term.meaningIt,
            mediaId: media.id,
            mediaSlug: media.slug,
            mediaTitle: media.title,
            reading: term.reading
          })
          .from(term)
          .innerJoin(media, eq(media.id, term.mediaId))
          .where(inArray(term.id, termEntryIds)),
    grammarEntryIds.length === 0
      ? Promise.resolve([])
      : input.database
          .select({
            entryId: grammarPattern.id,
            label: grammarPattern.pattern,
            meaningIt: grammarPattern.meaningIt,
            mediaId: media.id,
            mediaSlug: media.slug,
            mediaTitle: media.title,
            reading: grammarPattern.reading
          })
          .from(grammarPattern)
          .innerJoin(media, eq(media.id, grammarPattern.mediaId))
          .where(inArray(grammarPattern.id, grammarEntryIds)),
    termGroupIds.length === 0
      ? Promise.resolve([])
      : input.database
          .select({
            crossMediaGroupId: term.crossMediaGroupId,
            entryId: term.id,
            label: term.lemma,
            meaningIt: term.meaningIt,
            mediaId: media.id,
            mediaSlug: media.slug,
            mediaTitle: media.title,
            reading: term.reading
          })
          .from(term)
          .innerJoin(media, eq(media.id, term.mediaId))
          .where(inArray(term.crossMediaGroupId, termGroupIds)),
    grammarGroupIds.length === 0
      ? Promise.resolve([])
      : input.database
          .select({
            crossMediaGroupId: grammarPattern.crossMediaGroupId,
            entryId: grammarPattern.id,
            label: grammarPattern.pattern,
            meaningIt: grammarPattern.meaningIt,
            mediaId: media.id,
            mediaSlug: media.slug,
            mediaTitle: media.title,
            reading: grammarPattern.reading
          })
          .from(grammarPattern)
          .innerJoin(media, eq(media.id, grammarPattern.mediaId))
          .where(inArray(grammarPattern.crossMediaGroupId, grammarGroupIds)),
    cardIds.length === 0
      ? Promise.resolve([])
      : input.database
          .select({
            back: card.back,
            cardId: card.id,
            front: card.front,
            mediaId: media.id,
            mediaSlug: media.slug,
            mediaTitle: media.title
          })
          .from(card)
          .innerJoin(media, eq(media.id, card.mediaId))
          .where(inArray(card.id, cardIds))
  ]);

  for (const row of termRows) {
    subjects.set(
      `entry:term:${row.entryId}`,
      buildManualContrastSubject({
        entryType: "term",
        label: row.label,
        members: [
          {
            entryId: row.entryId,
            lemma: row.label,
            meaningIt: row.meaningIt,
            mediaId: row.mediaId,
            mediaSlug: row.mediaSlug,
            mediaTitle: row.mediaTitle,
            reading: row.reading ?? ""
          }
        ],
        reading: row.reading ?? null,
        source: {
          entryId: row.entryId,
          type: "entry"
        },
        subjectKey: `entry:term:${row.entryId}`
      })
    );
  }

  for (const row of grammarRows) {
    subjects.set(
      `entry:grammar:${row.entryId}`,
      buildManualContrastSubject({
        entryType: "grammar",
        label: row.label,
        members: [
          {
            entryId: row.entryId,
            lemma: row.label,
            meaningIt: row.meaningIt,
            mediaId: row.mediaId,
            mediaSlug: row.mediaSlug,
            mediaTitle: row.mediaTitle,
            reading: row.reading ?? ""
          }
        ],
        reading: row.reading ?? null,
        source: {
          entryId: row.entryId,
          type: "entry"
        },
        subjectKey: `entry:grammar:${row.entryId}`
      })
    );
  }

  for (const [groupId, rows] of groupBy(
    termGroupRows,
    (row) => row.crossMediaGroupId
  )) {
    if (!groupId) {
      continue;
    }

    subjects.set(
      `group:term:${groupId}`,
      buildManualContrastSubject({
        entryType: "term",
        label: rows[0]?.label ?? groupId,
        members: rows.map((row) => ({
          entryId: row.entryId,
          lemma: row.label,
          meaningIt: row.meaningIt,
          mediaId: row.mediaId,
          mediaSlug: row.mediaSlug,
          mediaTitle: row.mediaTitle,
          reading: row.reading ?? ""
        })),
        reading: rows.find((row) => Boolean(row.reading?.trim()))?.reading ?? null,
        source: {
          crossMediaGroupId: groupId,
          type: "group"
        },
        subjectKey: `group:term:${groupId}`
      })
    );
  }

  for (const [groupId, rows] of groupBy(
    grammarGroupRows,
    (row) => row.crossMediaGroupId
  )) {
    if (!groupId) {
      continue;
    }

    subjects.set(
      `group:grammar:${groupId}`,
      buildManualContrastSubject({
        entryType: "grammar",
        label: rows[0]?.label ?? groupId,
        members: rows.map((row) => ({
          entryId: row.entryId,
          lemma: row.label,
          meaningIt: row.meaningIt,
          mediaId: row.mediaId,
          mediaSlug: row.mediaSlug,
          mediaTitle: row.mediaTitle,
          reading: row.reading ?? ""
        })),
        reading: rows.find((row) => Boolean(row.reading?.trim()))?.reading ?? null,
        source: {
          crossMediaGroupId: groupId,
          type: "group"
        },
        subjectKey: `group:grammar:${groupId}`
      })
    );
  }

  for (const row of cardRows) {
    subjects.set(
      `card:${row.cardId}`,
      buildManualContrastSubject({
        entryType: null,
        label: row.front,
        members: [
          {
            entryId: row.cardId,
            lemma: row.front,
            meaningIt: row.back,
            mediaId: row.mediaId,
            mediaSlug: row.mediaSlug,
            mediaTitle: row.mediaTitle,
            reading: ""
          }
        ],
        reading: null,
        source: {
          cardId: row.cardId,
          type: "card"
        },
        subjectKey: `card:${row.cardId}`
      })
    );
  }

  return subjects;
}

function parseManualContrastSubjectKey(subjectKey: string) {
  if (subjectKey.startsWith("card:")) {
    return {
      cardId: subjectKey.slice("card:".length),
      kind: "card" as const
    };
  }

  const match = /^(group|entry):(term|grammar):(.+)$/u.exec(subjectKey);

  if (!match) {
    return null;
  }

  const [, kind, entryType, value] = match;

  return kind === "group"
    ? {
        crossMediaGroupId: value,
        entryType: entryType as "grammar" | "term",
        kind: "group" as const
      }
    : {
        entryId: value,
        entryType: entryType as "grammar" | "term",
        kind: "entry" as const
      };
}

function buildManualContrastSubject(input: {
  entryType: EntryType | null;
  label: string;
  members: Array<{
    entryId: string;
    lemma: string;
    meaningIt: string;
    mediaId: string;
    mediaSlug: string;
    mediaTitle: string;
    reading: string;
  }>;
  reading: string | null;
  source: KanjiClashEligibleSubject["source"];
  subjectKey: string;
}) {
  const surfaceForms = dedupeStable(
    input.members
      .map((member) => normalizeKanjiClashSurface(member.lemma))
      .filter((surface) => surface.length > 0)
  );
  const readingForms = dedupeStable(
    input.members
      .map((member) => normalizeKanjiClashSurface(member.reading))
      .filter((reading) => reading.length > 0)
  );

  return {
    entryType: input.entryType,
    kanji: collectKanjiFromSurfaces(surfaceForms),
    label: input.label,
    members: input.members,
    reading: input.reading,
    readingForms,
    reps: 0,
    reviewState: "review" as const,
    source: input.source,
    stability: 0,
    subjectKey: input.subjectKey,
    surfaceForms
  };
}

function subjectMatchesMediaFilter(
  subject: KanjiClashEligibleSubject,
  mediaIds: string[]
) {
  return subject.members.some((member) => mediaIds.includes(member.mediaId));
}

function buildManualContrastScore(
  contrast: typeof kanjiClashManualContrast.$inferSelect
) {
  const timestamp = Date.parse(
    contrast.lastForcedAt ??
      contrast.lastConfirmedAt ??
      contrast.updatedAt ??
      contrast.createdAt
  );

  return 1_000_000_000 + (Number.isFinite(timestamp) ? timestamp : 0);
}

function dedupeStable<T>(values: T[]) {
  const seen = new Set<T>();
  const result: T[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function groupBy<T, K>(values: T[], keySelector: (value: T) => K) {
  const groups = new Map<K, T[]>();

  for (const value of values) {
    const key = keySelector(value);
    const existing = groups.get(key);

    if (existing) {
      existing.push(value);
      continue;
    }

    groups.set(key, [value]);
  }

  return groups;
}
