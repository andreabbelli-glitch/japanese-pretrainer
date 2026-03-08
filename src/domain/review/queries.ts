import { getItems } from "@/src/domain/content";
import {
  getDueReviewItems,
  getUserItemProgressByItemIds,
  getUserSettings,
  type UserItemProgressRow,
} from "@/src/features/user-data/repository";
import type { SessionQueueEntry } from "@/src/domain/review/types";

const DEFAULT_DAILY_NEW_LIMIT = 10;
const DEFAULT_DAILY_REVIEW_GOAL = 50;

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
  }));
}

export async function getNewQueueEntries(supabase: unknown, userId: string, limit: number): Promise<SessionQueueEntry[]> {
  const allItems = getItems();
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
  }));
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
