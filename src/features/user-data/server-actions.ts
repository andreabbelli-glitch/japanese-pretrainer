"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/src/lib/supabase/server";
import {
  archiveUserGoal,
  createUserGoal,
  getAuthenticatedUserId,
  listActiveUserGoals,
  recordItemContextExposure,
  type UserGoalRow,
} from "@/src/features/user-data/repository";
import type { Database } from "@/src/lib/supabase/database.types";

type GoalInsert = Omit<Database["public"]["Tables"]["user_goals"]["Insert"], "user_id">;
type ExposureInsert = Omit<Database["public"]["Tables"]["user_item_context_exposure"]["Insert"], "user_id">;

export async function createGoalAction(payload: GoalInsert): Promise<UserGoalRow> {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);
  const goal = await createUserGoal(supabase, { ...payload, user_id: userId });
  revalidatePath("/goals");
  return goal;
}

export async function archiveGoalAction(goalId: string, archiveReason?: string): Promise<UserGoalRow> {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);
  const goal = await archiveUserGoal(supabase, userId, goalId, archiveReason);
  revalidatePath("/goals");
  return goal;
}

export async function listActiveGoalsAction(): Promise<UserGoalRow[]> {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);
  return listActiveUserGoals(supabase, userId);
}

export async function recordItemContextExposureAction(payload: ExposureInsert) {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);
  return recordItemContextExposure(supabase, {
    ...payload,
    user_id: userId,
  });
}
