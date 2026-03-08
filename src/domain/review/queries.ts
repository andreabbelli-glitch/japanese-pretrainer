import { getLanguageItems } from "@/src/domain/content";
import { getRequiredItemIdsForTarget } from "@/src/domain/learning/coverage";
import type { GoalTarget } from "@/src/domain/learning/types";
import {
  getDueReviewItems,
  getUserItemProgressByItemIds,
  getUserSettings,
  listActiveUserGoals,
  type UserGoalRow,
  type UserItemProgressRow,
} from "@/src/features/user-data/repository";
import type { ReviewQueueFilters, SessionQueueEntry } from "@/src/domain/review/types";

const DEFAULT_DAILY_NEW_LIMIT = 10;
const DEFAULT_DAILY_REVIEW_GOAL = 50;

const TARGET_KIND_BY_GOAL_TYPE: Record<UserGoalRow["target_type"], GoalTarget["targetType"]> = {
  game: "game",
  product: "product",
  unit: "unit",
  custom: "goal",
};

export async function getReviewSettings(supabase: unknown, userId: string) {
  const settings = await getUserSettings(supabase, userId);

  return {
    dailyNewLimit: settings?.daily_new_limit ?? DEFAULT_DAILY_NEW_LIMIT,
    dailyReviewGoal: settings?.daily_review_goal ?? DEFAULT_DAILY_REVIEW_GOAL,
  };
}

export async function getDueQueueEntries(supabase: unknown, userId: string, limit: number): Promise<SessionQueueEntry[]> {
  const dueRows = await getDueReviewItems(supabase, userId, limit);

  return dueRows.map((row) => ({
    itemId: row.item_id,
    isDue: true,
    isNew: false,
    dueAt: row.due_at,
    masteryScore: row.mastery_score ?? 0,
  }));
}

export async function getNewQueueEntries(supabase: unknown, userId: string, limit: number): Promise<SessionQueueEntry[]> {
  const allItems = getLanguageItems();
  const progressRows = await getUserItemProgressByItemIds(
    supabase,
    userId,
    allItems.map((item) => item.id),
  );

  const knownIds = new Set(progressRows.map((row) => row.item_id));
  const freshItems = allItems.filter((item) => !knownIds.has(item.id)).slice(0, limit);

  return freshItems.map((item) => ({
    itemId: item.id,
    isDue: false,
    isNew: true,
    dueAt: null,
    masteryScore: 0,
  }));
}

export async function getMasteryMap(supabase: unknown, userId: string, itemIds: string[]) {
  const progressRows = await getUserItemProgressByItemIds(supabase, userId, itemIds);
  const masteryByItemId = new Map<string, number>();

  for (const row of progressRows) {
    masteryByItemId.set(row.item_id, row.mastery_score ?? 0);
  }

  return masteryByItemId;
}

export async function getActiveGoals(supabase: unknown, userId: string) {
  return listActiveUserGoals(supabase, userId);
}

export function goalToTarget(goal: UserGoalRow): GoalTarget {
  if (goal.target_type === "custom") {
    return {
      id: goal.id,
      targetType: "goal",
      itemIds: goal.linked_item_ids,
      title: goal.title,
    };
  }

  const target: GoalTarget = {
    id: goal.id,
    targetType: TARGET_KIND_BY_GOAL_TYPE[goal.target_type],
    title: goal.title,
  };

  if (goal.target_id) {
    if (goal.target_type === "game") target.gameId = goal.target_id;
    if (goal.target_type === "product") {
      const [gameId, productId] = goal.target_id.split("::");
      target.gameId = gameId;
      target.productId = productId;
    }
    if (goal.target_type === "unit") {
      const [gameId, productId, unitId] = goal.target_id.split("::");
      target.gameId = gameId;
      target.productId = productId;
      target.unitId = unitId;
    }
  }

  if (goal.linked_item_ids.length > 0) {
    target.itemIds = goal.linked_item_ids;
  }

  return target;
}

export function getGoalScopedItemIds(goal: UserGoalRow): string[] {
  const linked = goal.linked_item_ids ?? [];
  if (linked.length > 0) return linked;

  const target = goalToTarget(goal);
  return getRequiredItemIdsForTarget(target);
}

export async function resolveReviewFilters(supabase: unknown, userId: string, filters: ReviewQueueFilters) {
  if (filters.mode === "global") {
    return { goal: null, target: null, scopedItemIds: [] as string[] };
  }

  const goals = await getActiveGoals(supabase, userId);
  const goal = filters.goalId ? goals.find((entry) => entry.id === filters.goalId) : goals[0];

  if (!goal) {
    return { goal: null, target: null, scopedItemIds: [] as string[] };
  }

  return {
    goal,
    target: goalToTarget(goal),
    scopedItemIds: getGoalScopedItemIds(goal),
  };
}

export function toSnapshot(row: UserItemProgressRow) {
  return {
    itemId: row.item_id,
    state: row.state,
    dueAt: row.due_at,
    intervalDays: Number(row.interval_days ?? 0),
    easeFactor: Number(row.ease_factor ?? 2.5),
    reps: row.reps ?? 0,
    lapses: row.lapses ?? 0,
    streak: row.streak ?? 0,
    masteryScore: row.mastery_score ?? 0,
    lastRating: row.last_rating,
  } as const;
}
