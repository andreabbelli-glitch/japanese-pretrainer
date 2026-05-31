import type { DatabaseQueryClient } from "@/db";
import type { EntryType } from "@/db/schema";
import {
  deriveReviewSubjectIdentity,
  normalizeReviewSubjectSurface,
  type ReviewSubjectIdentity
} from "@/features/review/model/subject";
import { buildEntryKey } from "@/features/study/model/entry-id";
import type { PronunciationData } from "@/features/pronunciation/model/data";

import type {
  ConsolidationOption,
  ConsolidationOptionKind,
  ConsolidationSessionStepData,
  PreReviewConsolidationStep
} from "./contracts";
import {
  buildConsolidationEntrySummaryLookup,
  type ConsolidationEntrySummary
} from "./entry-lookups";
import type {
  FallbackConsolidationCard,
  PendingConsolidationRow
} from "./read-queries";

type ConsolidationSubjectPresentation = {
  attemptCount: number;
  back: string;
  canMarkKnown: boolean;
  choiceGroupId: string | null;
  entryType: EntryType | null;
  front: string;
  kind: ConsolidationOptionKind;
  lessonId: string | null;
  meaning: string;
  pending: boolean;
  pronunciation?: PronunciationData;
  reading: string | null;
  representativeCardId: string;
  subjectKey: string;
};

export async function buildConsolidationPresentations(input: {
  choiceGroupId?: (row: PendingConsolidationRow) => string | null;
  database: DatabaseQueryClient;
  fallbackCards: FallbackConsolidationCard[];
  pendingRows: PendingConsolidationRow[];
}) {
  const cardLikes = [
    ...input.pendingRows.map((row) => row.representativeCard),
    ...input.fallbackCards
  ];
  const entryLookup = await buildConsolidationEntrySummaryLookup(
    input.database,
    cardLikes
  );
  const presentations = new Map<string, ConsolidationSubjectPresentation>();

  for (const row of input.pendingRows) {
    presentations.set(
      row.subjectKey,
      buildPendingRowPresentation(row, entryLookup, {
        choiceGroupId: input.choiceGroupId?.(row) ?? row.lessonId
      })
    );
  }

  for (const fallbackCard of input.fallbackCards) {
    const identity = deriveReviewSubjectIdentity({
      cardId: fallbackCard.id,
      cardType: fallbackCard.cardType,
      entryLinks: fallbackCard.entryLinks,
      entryLookup,
      front: fallbackCard.front
    });

    if (presentations.has(identity.subjectKey)) {
      continue;
    }

    presentations.set(
      identity.subjectKey,
      buildCardPresentation({
        attemptCount: 0,
        cardItem: fallbackCard,
        identity,
        entryLookup
      })
    );
  }

  return [...presentations.values()];
}

function buildPendingRowPresentation(
  row: PendingConsolidationRow,
  entryLookup: Map<string, ConsolidationEntrySummary>,
  options: {
    choiceGroupId?: string | null;
  } = {}
): ConsolidationSubjectPresentation {
  return buildCardPresentation({
    attemptCount: row.attemptCount,
    cardItem: row.representativeCard,
    entryLookup,
    identity: {
      cardId: row.representativeCardId,
      crossMediaGroupId: row.crossMediaGroupId,
      entryId: row.entryId,
      entryType: row.entryType,
      subjectKey: row.subjectKey,
      subjectKind: row.subjectType
    },
    lessonId: row.lessonId,
    canMarkKnown: row.status === "pending",
    choiceGroupId: options.choiceGroupId ?? row.lessonId,
    pending: true
  });
}

function buildCardPresentation(input: {
  attemptCount: number;
  cardItem:
    | PendingConsolidationRow["representativeCard"]
    | FallbackConsolidationCard;
  choiceGroupId?: string | null;
  entryLookup: Map<string, ConsolidationEntrySummary>;
  identity: ReviewSubjectIdentity;
  canMarkKnown?: boolean;
  lessonId?: string | null;
  pending?: boolean;
}): ConsolidationSubjectPresentation {
  const entry =
    input.identity.entryType && input.identity.entryId
      ? (input.entryLookup.get(
          buildEntryKey(input.identity.entryType, input.identity.entryId)
        ) ?? null)
      : null;

  return {
    attemptCount: input.attemptCount,
    back: input.cardItem.back,
    canMarkKnown: input.canMarkKnown ?? false,
    choiceGroupId:
      input.choiceGroupId ?? input.lessonId ?? input.cardItem.lessonId,
    entryType: input.identity.entryType,
    front: input.cardItem.front,
    kind: input.identity.entryType ?? "card",
    lessonId: input.lessonId ?? input.cardItem.lessonId,
    meaning: entry?.meaning ?? input.cardItem.back,
    pending: input.pending ?? false,
    pronunciation: entry?.pronunciation,
    reading: entry?.reading?.trim() || null,
    representativeCardId: input.cardItem.id,
    subjectKey: input.identity.subjectKey
  };
}

export function buildSessionSteps(
  target: ConsolidationSubjectPresentation,
  pool: ConsolidationSubjectPresentation[]
): ConsolidationSessionStepData[] {
  const steps: ConsolidationSessionStepData[] = [];

  if (
    target.reading &&
    readingAddsRetrievalValue(target.front, target.reading)
  ) {
    steps.push({
      answerLabel: target.reading,
      options: buildStepOptions(target, pool, "reading"),
      step: "reading"
    });
  }

  steps.push({
    answerLabel: target.meaning,
    options: buildStepOptions(target, pool, "meaning"),
    step: "meaning"
  });

  return steps;
}

function buildStepOptions(
  target: ConsolidationSubjectPresentation,
  pool: ConsolidationSubjectPresentation[],
  step: PreReviewConsolidationStep
): ConsolidationOption[] {
  const seed = [
    target.choiceGroupId ?? target.lessonId ?? "media",
    target.subjectKey,
    step,
    String(target.attemptCount)
  ].join(":");
  const currentLessonPendingCandidates = deterministicShuffle(
    pool.filter(
      (candidate) =>
        candidate.subjectKey !== target.subjectKey &&
        candidate.pending &&
        Boolean(target.choiceGroupId) &&
        candidate.choiceGroupId === target.choiceGroupId
    ),
    `${seed}:pending`
  );
  const pendingCandidateKeys = new Set(
    currentLessonPendingCandidates.map((candidate) => candidate.subjectKey)
  );
  const fallbackCandidates = deterministicShuffle(
    pool.filter(
      (candidate) =>
        candidate.subjectKey !== target.subjectKey &&
        !pendingCandidateKeys.has(candidate.subjectKey)
    ),
    `${seed}:fallback`
  );
  const options = new Map<string, ConsolidationOption>();

  addOption(options, target, step);

  for (const candidate of [
    ...currentLessonPendingCandidates,
    ...fallbackCandidates
  ]) {
    addOption(options, candidate, step);

    if (options.size >= 4) {
      break;
    }
  }

  return deterministicShuffle([...options.values()], `${seed}:options`);
}

function addOption(
  options: Map<string, ConsolidationOption>,
  presentation: ConsolidationSubjectPresentation,
  step: PreReviewConsolidationStep
) {
  const label = getStepAnswerLabel(presentation, step);
  const normalizedLabel = normalizeOptionLabel(label);

  if (!label || options.has(normalizedLabel)) {
    return;
  }

  options.set(normalizedLabel, {
    kind: presentation.kind,
    label,
    subjectKey: presentation.subjectKey
  });
}

function getStepAnswerLabel(
  presentation: ConsolidationSubjectPresentation,
  step: PreReviewConsolidationStep
) {
  return step === "reading"
    ? (presentation.reading?.trim() ?? "")
    : presentation.meaning.trim();
}

function readingAddsRetrievalValue(front: string, reading: string) {
  return (
    normalizeReviewSubjectSurface(front) !==
    normalizeReviewSubjectSurface(reading)
  );
}

export async function subjectRequiresReadingStep(
  database: DatabaseQueryClient,
  row: PendingConsolidationRow
) {
  if (!row.entryType || !row.entryId) {
    return false;
  }

  const entryLookup = await buildConsolidationEntrySummaryLookup(database, [
    row.representativeCard
  ]);
  const entry = entryLookup.get(buildEntryKey(row.entryType, row.entryId));
  const front = row.representativeCard.front;
  const reading = entry?.reading?.trim() || null;

  return reading ? readingAddsRetrievalValue(front, reading) : false;
}

function normalizeOptionLabel(label: string) {
  return label.replace(/\s+/g, " ").trim().toLocaleLowerCase("it-IT");
}

export function comparePendingRowsForSession(
  left: PendingConsolidationRow,
  right: PendingConsolidationRow
) {
  return (
    (left.representativeCard.orderIndex ?? Number.MAX_SAFE_INTEGER) -
      (right.representativeCard.orderIndex ?? Number.MAX_SAFE_INTEGER) ||
    left.representativeCard.createdAt.localeCompare(
      right.representativeCard.createdAt
    ) ||
    left.subjectKey.localeCompare(right.subjectKey)
  );
}

function deterministicShuffle<T>(items: T[], seed: string) {
  return [...items]
    .map((item, index) => ({
      item,
      rank: hashString(`${seed}:${index}`)
    }))
    .sort((left, right) => left.rank - right.rank)
    .map(({ item }) => item);
}

export function getDeterministicIndex(seed: string, modulo: number) {
  if (modulo <= 1) {
    return 0;
  }

  return hashString(seed) % modulo;
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
