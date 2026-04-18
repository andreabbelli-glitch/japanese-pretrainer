import { and, asc, eq } from "drizzle-orm";

import {
  crossMediaGroup,
  grammarPattern,
  kanjiClashManualContrast,
  kanjiClashManualContrastRoundState,
  listReviewCardIdsByEntryRefs,
  term,
  type DatabaseClient,
  type EntryType
} from "@/db";

import { buildKanjiClashContrastKey } from "./utils";
import {
  REVIEW_FORCED_CONTRAST_SAME_SUBJECT_ERROR,
  REVIEW_FORCED_CONTRAST_TARGET_UNAVAILABLE_ERROR
} from "@/lib/review-error-messages";
import { buildReviewSubjectKey, type ReviewSubjectIdentity } from "@/lib/review-subject";
import type {
  ReviewForcedContrastEndpoint,
  ReviewForcedContrastPayload,
  ReviewForcedContrastResolution,
  ReviewScope
} from "@/lib/review-types";

export type ManualContrastReviewTransaction = Parameters<
  Parameters<DatabaseClient["transaction"]>[0]
>[0];

type GlossaryResultKey = {
  entryType: EntryType;
  value: string;
  variant: "entry" | "group";
};

type SubjectDirection = "subject_a" | "subject_b";

export async function resolveReviewForcedContrast(input: {
  identity: ReviewSubjectIdentity;
  mediaId?: string;
  mediaSlug?: string;
  nowIso?: string;
  payload: ReviewForcedContrastPayload;
  scope: ReviewScope;
  transaction: ManualContrastReviewTransaction;
}): Promise<ReviewForcedContrastResolution> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const current = resolveReviewForcedContrastEndpoint(input.identity);
  const target = await resolveGlossaryResultKeyToReviewForcedContrastEndpoint({
    resultKey: input.payload.targetResultKey,
    transaction: input.transaction
  });

  if (!target) {
    throw new Error(REVIEW_FORCED_CONTRAST_TARGET_UNAVAILABLE_ERROR);
  }

  if (current.subjectKey === target.subjectKey) {
    throw new Error(REVIEW_FORCED_CONTRAST_SAME_SUBJECT_ERROR);
  }

  await upsertForcedManualContrast({
    current,
    nowIso,
    target,
    transaction: input.transaction
  });

  return {
    contrastKey: buildKanjiClashContrastKey(current.subjectKey, target.subjectKey),
    current,
    mediaId: input.mediaId,
    mediaSlug: input.mediaSlug,
    scope: input.scope,
    source: "forced",
    target
  };
}

export function resolveReviewForcedContrastEndpoint(
  identity: ReviewSubjectIdentity
): ReviewForcedContrastEndpoint {
  return {
    cardId: identity.cardId,
    crossMediaGroupId: identity.crossMediaGroupId,
    entryId: identity.entryId,
    entryType: identity.entryType,
    subjectKey: identity.subjectKey,
    subjectType: identity.subjectKind
  };
}

async function resolveGlossaryResultKeyToReviewForcedContrastEndpoint(input: {
  resultKey: string;
  transaction: ManualContrastReviewTransaction;
}): Promise<ReviewForcedContrastEndpoint | null> {
  const parsed = parseGlossaryResultKey(input.resultKey);

  if (!parsed) {
    return null;
  }

  if (parsed.variant === "entry") {
    return resolveEntryResultKeyToEndpoint({
      entryId: parsed.value,
      entryType: parsed.entryType,
      transaction: input.transaction
    });
  }

  return resolveGroupResultKeyToEndpoint({
    entryType: parsed.entryType,
    groupKey: parsed.value,
    transaction: input.transaction
  });
}

function parseGlossaryResultKey(resultKey: string): GlossaryResultKey | null {
  const match = /^(term|grammar):(entry|group):(.+)$/u.exec(resultKey.trim());

  if (!match) {
    return null;
  }

  const [, entryType, variant, value] = match;

  if (!value) {
    return null;
  }

  return {
    entryType: entryType as EntryType,
    value,
    variant: variant as "entry" | "group"
  };
}

async function resolveEntryResultKeyToEndpoint(input: {
  entryId: string;
  entryType: EntryType;
  transaction: ManualContrastReviewTransaction;
}): Promise<ReviewForcedContrastEndpoint | null> {
  const entry =
    input.entryType === "term"
      ? await input.transaction.query.term.findFirst({
          columns: {
            crossMediaGroupId: true,
            id: true
          },
          where: eq(term.id, input.entryId)
        })
      : await input.transaction.query.grammarPattern.findFirst({
          columns: {
            crossMediaGroupId: true,
            id: true
          },
          where: eq(grammarPattern.id, input.entryId)
        });

  if (!entry) {
    return null;
  }

  const reviewCardIds = await listReviewCardIdsByEntryRefs(input.transaction, [
    {
      entryId: entry.id,
      entryType: input.entryType
    }
  ]);

  if (reviewCardIds.length === 0) {
    return null;
  }

  const subjectType = entry.crossMediaGroupId ? "group" : "entry";

  return {
    cardId: null,
    crossMediaGroupId: entry.crossMediaGroupId,
    entryId: entry.id,
    entryType: input.entryType,
    subjectKey: buildReviewSubjectKey({
      crossMediaGroupId: entry.crossMediaGroupId,
      entryId: entry.id,
      entryType: input.entryType,
      subjectKind: subjectType
    }),
    subjectType
  };
}

async function resolveGroupResultKeyToEndpoint(input: {
  entryType: EntryType;
  groupKey: string;
  transaction: ManualContrastReviewTransaction;
}): Promise<ReviewForcedContrastEndpoint | null> {
  const group = await input.transaction.query.crossMediaGroup.findFirst({
    columns: {
      id: true
    },
    where: and(
      eq(crossMediaGroup.entryType, input.entryType),
      eq(crossMediaGroup.groupKey, input.groupKey)
    )
  });

  if (!group) {
    return null;
  }

  const entries =
    input.entryType === "term"
      ? await input.transaction.query.term.findMany({
          columns: {
            id: true
          },
          orderBy: [asc(term.lemma), asc(term.reading), asc(term.id)],
          where: eq(term.crossMediaGroupId, group.id)
        })
      : await input.transaction.query.grammarPattern.findMany({
          columns: {
            id: true
          },
          orderBy: [
            asc(grammarPattern.pattern),
            asc(grammarPattern.title),
            asc(grammarPattern.id)
          ],
          where: eq(grammarPattern.crossMediaGroupId, group.id)
        });

  if (entries.length === 0) {
    return null;
  }

  const reviewCardIds = await listReviewCardIdsByEntryRefs(
    input.transaction,
    entries.map((entry) => ({
      entryId: entry.id,
      entryType: input.entryType
    }))
  );

  if (reviewCardIds.length === 0) {
    return null;
  }

  const representativeEntryId = entries[0]!.id;

  return {
    cardId: null,
    crossMediaGroupId: group.id,
    entryId: representativeEntryId,
    entryType: input.entryType,
    subjectKey: buildReviewSubjectKey({
      crossMediaGroupId: group.id,
      entryId: representativeEntryId,
      entryType: input.entryType,
      subjectKind: "group"
    }),
    subjectType: "group"
  };
}

async function upsertForcedManualContrast(input: {
  current: ReviewForcedContrastEndpoint;
  nowIso: string;
  target: ReviewForcedContrastEndpoint;
  transaction: ManualContrastReviewTransaction;
}) {
  const [subjectA, subjectB] = [input.current, input.target].sort((left, right) =>
    left.subjectKey.localeCompare(right.subjectKey)
  );
  const contrastKey = buildKanjiClashContrastKey(
    subjectA.subjectKey,
    subjectB.subjectKey
  );
  const existingContrast =
    await input.transaction.query.kanjiClashManualContrast.findFirst({
      where: eq(kanjiClashManualContrast.contrastKey, contrastKey)
    });

  if (existingContrast) {
    await input.transaction
      .update(kanjiClashManualContrast)
      .set({
        forcedDueAt: input.nowIso,
        lastConfirmedAt: input.nowIso,
        lastForcedAt: input.nowIso,
        source: "forced",
        status: "active",
        timesConfirmed: existingContrast.timesConfirmed + 1,
        updatedAt: input.nowIso
      })
      .where(eq(kanjiClashManualContrast.contrastKey, contrastKey));
  } else {
    await input.transaction.insert(kanjiClashManualContrast).values({
      contrastKey,
      createdAt: input.nowIso,
      forcedDueAt: input.nowIso,
      lastConfirmedAt: input.nowIso,
      lastForcedAt: input.nowIso,
      source: "forced",
      status: "active",
      subjectAKey: subjectA.subjectKey,
      subjectBKey: subjectB.subjectKey,
      timesConfirmed: 1,
      updatedAt: input.nowIso
    });
  }

  await upsertManualContrastRoundState({
    contrastKey,
    direction: "subject_a",
    nowIso: input.nowIso,
    subjectAKey: subjectA.subjectKey,
    subjectBKey: subjectB.subjectKey,
    targetSubjectKey: subjectA.subjectKey,
    transaction: input.transaction
  });
  await upsertManualContrastRoundState({
    contrastKey,
    direction: "subject_b",
    nowIso: input.nowIso,
    subjectAKey: subjectA.subjectKey,
    subjectBKey: subjectB.subjectKey,
    targetSubjectKey: subjectB.subjectKey,
    transaction: input.transaction
  });
}

async function upsertManualContrastRoundState(input: {
  contrastKey: string;
  direction: SubjectDirection;
  nowIso: string;
  subjectAKey: string;
  subjectBKey: string;
  targetSubjectKey: string;
  transaction: ManualContrastReviewTransaction;
}) {
  const roundKey = buildManualContrastRoundKey(input.contrastKey, input.direction);
  const existing =
    await input.transaction.query.kanjiClashManualContrastRoundState.findFirst({
      where: eq(kanjiClashManualContrastRoundState.roundKey, roundKey)
    });

  if (existing) {
    await input.transaction
      .update(kanjiClashManualContrastRoundState)
      .set({
        dueAt: input.nowIso,
        lastInteractionAt: input.nowIso,
        leftSubjectKey: input.subjectAKey,
        rightSubjectKey: input.subjectBKey,
        targetSubjectKey: input.targetSubjectKey,
        updatedAt: input.nowIso
      })
      .where(eq(kanjiClashManualContrastRoundState.roundKey, roundKey));
    return;
  }

  await input.transaction.insert(kanjiClashManualContrastRoundState).values({
    contrastKey: input.contrastKey,
    createdAt: input.nowIso,
    difficulty: null,
    direction: input.direction,
    dueAt: input.nowIso,
    lapses: 0,
    lastInteractionAt: input.nowIso,
    lastReviewedAt: null,
    learningSteps: 0,
    leftSubjectKey: input.subjectAKey,
    reps: 0,
    rightSubjectKey: input.subjectBKey,
    roundKey,
    scheduledDays: 0,
    stability: null,
    state: "new",
    targetSubjectKey: input.targetSubjectKey,
    updatedAt: input.nowIso
  });
}

function buildManualContrastRoundKey(
  contrastKey: string,
  direction: SubjectDirection
) {
  return `${contrastKey}::${direction}`;
}
