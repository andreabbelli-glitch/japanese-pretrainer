import {
  getCardById,
  getCards,
  getDeckBySlug,
  getDecks,
  getItemById,
  getLessons,
  getItems,
  type StudyCard,
} from "@/src/domain/content";
import type { UserItemProgressRow } from "@/src/features/user-data/repository";
import type { DashboardMetrics, DeckCoverage, ItemMastery } from "@/src/domain/progress/types";
import type { ReviewEventRow, ReviewSessionRow } from "@/src/features/user-data/repository";

const ITEM_WEIGHT: Record<string, number> = {
  core: 3,
  important: 2,
  nice: 1,
};

const BASE_STATE_SCORE: Record<string, number> = {
  new: 0,
  learning: 28,
  review: 58,
  relearning: 32,
  mature: 86,
};

const ONE_DAY = 24 * 60 * 60 * 1000;

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function computeMasteryFromProgress(row: UserItemProgressRow, now = new Date()): ItemMastery {
  const base = BASE_STATE_SCORE[row.state] ?? 0;
  const intervalBonus = Math.min((row.interval_days ?? 0) * 1.4, 14);
  const streakBonus = Math.min((row.streak ?? 0) * 1.8, 10);
  const lapsePenalty = Math.min((row.lapses ?? 0) * 4, 20);

  let recencyPenalty = 0;
  if (row.last_reviewed_at) {
    const daysFromReview = Math.max(0, (now.getTime() - new Date(row.last_reviewed_at).getTime()) / ONE_DAY);
    recencyPenalty = Math.min(daysFromReview * 1.2, 15);
  }

  let duePenalty = 0;
  if (row.due_at) {
    const daysOverdue = (now.getTime() - new Date(row.due_at).getTime()) / ONE_DAY;
    if (daysOverdue > 0) {
      duePenalty = Math.min(daysOverdue * 6, 20);
    }
  }

  const raw = base + intervalBonus + streakBonus - lapsePenalty - recencyPenalty - duePenalty;
  return {
    itemId: row.item_id,
    score: clamp(Math.round(raw)),
    state: row.state,
    dueAt: row.due_at,
    intervalDays: row.interval_days,
    lapses: row.lapses,
    streak: row.streak,
    lastReviewedAt: row.last_reviewed_at,
  };
}

export function computeCardCoverage(card: StudyCard, masteryByItemId: Map<string, number>) {
  const requiredIds = Array.from(new Set([...card.itemIds, ...card.keyItemIds, ...card.keyPatternIds]));

  const weighted = requiredIds.map((itemId) => {
    const item = getItemById(itemId);
    if (!item) return null;
    const weight = ITEM_WEIGHT[item.priority] ?? 1;
    const mastery = masteryByItemId.get(item.id) ?? 0;
    return { item, weight, mastery, gap: (100 - mastery) * weight };
  });

  const valid = weighted.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const weightedMasterySum = valid.reduce((sum, entry) => sum + entry.mastery * entry.weight, 0);
  const weightedMax = valid.reduce((sum, entry) => sum + 100 * entry.weight, 0);
  const coverage = weightedMax > 0 ? Math.round((weightedMasterySum / weightedMax) * 100) : 0;

  return {
    card,
    coverage,
    weightedMasterySum,
    weightedMax,
    missingItems: valid
      .filter((entry) => entry.mastery < 80)
      .sort((a, b) => b.gap - a.gap)
      .map((entry) => ({ item: entry.item, mastery: entry.mastery, weight: entry.weight })),
  };
}

export function computeDeckCoverage(deckSlug: string, masteryByItemId: Map<string, number>): DeckCoverage | null {
  const deck = getDeckBySlug(deckSlug);
  if (!deck) return null;

  const cardCoverages = deck.uniqueCards
    .map((id) => getCardById(id))
    .filter((card): card is StudyCard => Boolean(card))
    .map((card) => computeCardCoverage(card, masteryByItemId));

  const coverage =
    cardCoverages.length > 0
      ? Math.round(cardCoverages.reduce((sum, card) => sum + card.coverage, 0) / cardCoverages.length)
      : 0;

  const bottlenecks = new Map<
    string,
    { itemId: string; gap: number; weight: number; cards: Set<string> }
  >();

  for (const card of cardCoverages) {
    for (const missing of card.missingItems) {
      const key = missing.item.id;
      const prev = bottlenecks.get(key) ?? { itemId: key, gap: 0, weight: missing.weight, cards: new Set<string>() };
      prev.gap += (100 - missing.mastery) * missing.weight;
      prev.cards.add(card.card.id);
      bottlenecks.set(key, prev);
    }
  }

  const topBottlenecks = Array.from(bottlenecks.values())
    .map((entry) => ({
      item: getItemById(entry.itemId),
      gap: Math.round(entry.gap),
      weight: entry.weight,
      cardCount: entry.cards.size,
    }))
    .filter((entry): entry is { item: NonNullable<ReturnType<typeof getItemById>>; gap: number; weight: number; cardCount: number } => Boolean(entry.item))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5);

  const unlockSuggestions = topBottlenecks
    .map((bottleneck) => {
      const unlocks = cardCoverages
        .filter((card) => card.coverage >= 55 && card.coverage < 85 && card.missingItems.some((m) => m.item.id === bottleneck.item.id))
        .map((card) => card.card);
      return {
        item: bottleneck.item,
        unlocks,
        impact: bottleneck.gap,
      };
    })
    .filter((entry) => entry.unlocks.length > 0)
    .slice(0, 4);

  return {
    deck,
    coverage,
    cards: cardCoverages,
    topBottlenecks,
    unlockSuggestions,
  };
}

function computeStreakDays(sessions: ReviewSessionRow[], now = new Date()) {
  const completedDays = new Set(
    sessions
      .filter((session) => session.status === "completed")
      .map((session) => new Date(session.created_at).toISOString().slice(0, 10)),
  );

  let streak = 0;
  const cursor = new Date(now);
  while (true) {
    const dayKey = cursor.toISOString().slice(0, 10);
    if (!completedDays.has(dayKey)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

function computeRetentionEstimate(events: ReviewEventRow[]) {
  if (events.length === 0) return 0;
  const retained = events.filter((event) => event.rating === "Good" || event.rating === "Easy").length;
  return Math.round((retained / events.length) * 100);
}

export function computeDashboardMetrics(input: {
  progressRows: UserItemProgressRow[];
  events: ReviewEventRow[];
  sessions: ReviewSessionRow[];
}): DashboardMetrics {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const lessons = getLessons();
  const decks = getDecks();

  const masteryByItemId = new Map<string, number>();
  for (const row of input.progressRows) {
    masteryByItemId.set(row.item_id, computeMasteryFromProgress(row, now).score);
  }

  const countsByState = {
    new: 0,
    learning: 0,
    review: 0,
    relearning: 0,
    mature: 0,
  } as DashboardMetrics["countsByState"];

  for (const row of input.progressRows) {
    countsByState[row.state] += 1;
  }

  const dueToday = input.progressRows.filter((row) => row.due_at && row.due_at.slice(0, 10) <= today).length;
  const newToday = getItems().length - input.progressRows.length;

  const sd1Coverage = computeDeckCoverage("dm25-sd1", masteryByItemId)?.coverage ?? 0;
  const sd2Coverage = computeDeckCoverage("dm25-sd2", masteryByItemId)?.coverage ?? 0;

  const allCards = getCards();
  const cardCoverages = allCards.map((card) => computeCardCoverage(card, masteryByItemId));

  const recentlyUnlockedCards = cardCoverages
    .filter((card) => card.coverage >= 75)
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, 6)
    .map((entry) => ({
      card: entry.card,
      coverage: entry.coverage,
      status: entry.coverage >= 85 ? ("readable" as const) : ("almost" as const),
    }));

  const weakLessons = lessons
    .map((lesson) => {
      const lessonItemScores = lesson.itemIds.map((id) => masteryByItemId.get(id) ?? 0);
      const avg = lessonItemScores.length > 0 ? lessonItemScores.reduce((sum, score) => sum + score, 0) / lessonItemScores.length : 0;
      return { lesson, avg };
    })
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)
    .map((entry) => ({
      lessonId: entry.lesson.id,
      slug: entry.lesson.slug,
      title: entry.lesson.title,
      reason: `Mastery media item ${Math.round(entry.avg)}%.`,
    }));

  void decks;

  return {
    dueToday,
    newToday,
    streakDays: computeStreakDays(input.sessions, now),
    retentionEstimate: computeRetentionEstimate(input.events),
    countsByState,
    sd1Coverage,
    sd2Coverage,
    suggestedLessons: weakLessons,
    recentlyUnlockedCards,
  };
}

export function buildMasteryMap(progressRows: UserItemProgressRow[]): Map<string, number> {
  const map = new Map<string, number>();
  const now = new Date();

  for (const row of progressRows) {
    map.set(row.item_id, computeMasteryFromProgress(row, now).score);
  }

  return map;
}
