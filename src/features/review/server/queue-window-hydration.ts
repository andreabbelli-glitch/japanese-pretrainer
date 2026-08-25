import type { DatabaseClient } from "@/db";
import { listReviewCardsByIds } from "@/db/queries";
import { hasCompletedReviewLesson } from "@/features/review/model/state";
import type { ReviewSubjectModel } from "@/features/review/model/queue-types";
import {
  buildEntryLookup,
  type ReviewEntryLookupItem
} from "@/features/review/server/card-presenters";
import { loadReviewEntrySummariesForCards } from "@/features/review/server/loader";
import {
  measureWith,
  type ReviewProfiler
} from "@/features/review/server/profiler";

export type HydratedReviewQueueWindow = {
  entryLookup: Map<string, ReviewEntryLookupItem>;
  modelsBySubjectKey: Map<string, ReviewSubjectModel>;
};

export async function hydrateReviewQueueWindow(input: {
  database: DatabaseClient;
  models: ReviewSubjectModel[];
  profiler?: ReviewProfiler | null;
}): Promise<HydratedReviewQueueWindow> {
  const models = dedupeModels(input.models);
  const cardIds = [
    ...new Set(
      models.flatMap((model) => model.group.cards.map((card) => card.id))
    )
  ];

  if (cardIds.length === 0) {
    return {
      entryLookup: new Map(),
      modelsBySubjectKey: new Map()
    };
  }

  const cards = (
    await measureWith(
      input.profiler,
      "listReviewCardsByIds.queueWindow",
      () => listReviewCardsByIds(input.database, cardIds),
      { requestedCards: cardIds.length }
    )
  ).filter(hasCompletedReviewLesson);
  const { grammar, terms } = await measureWith(
    input.profiler,
    "loadReviewEntrySummariesForCards.queueWindow",
    () =>
      loadReviewEntrySummariesForCards({
        cards,
        database: input.database,
        profiler: input.profiler
      }),
    { hydratedCards: cards.length }
  );
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const modelsBySubjectKey = new Map<string, ReviewSubjectModel>();

  for (const model of models) {
    const hydratedCards = model.group.cards.flatMap((card) => {
      const hydratedCard = cardsById.get(card.id);

      return hydratedCard ? [hydratedCard] : [];
    });
    const hydratedModelCard = cardsById.get(model.card.id);

    if (!hydratedModelCard || hydratedCards.length === 0) {
      continue;
    }

    modelsBySubjectKey.set(model.group.identity.subjectKey, {
      ...model,
      card: hydratedModelCard,
      group: {
        ...model.group,
        cards: hydratedCards,
        representativeCard:
          cardsById.get(model.group.representativeCard.id) ?? hydratedModelCard
      }
    });
  }

  input.profiler?.addMeta({
    queueWindowCards: cards.length,
    queueWindowModels: modelsBySubjectKey.size
  });

  return {
    entryLookup: buildEntryLookup(terms, grammar),
    modelsBySubjectKey
  };
}

function dedupeModels(models: ReviewSubjectModel[]) {
  const modelsBySubjectKey = new Map<string, ReviewSubjectModel>();

  for (const model of models) {
    modelsBySubjectKey.set(model.group.identity.subjectKey, model);
  }

  return [...modelsBySubjectKey.values()];
}
