"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedUserId, upsertUserSettings } from "@/src/features/user-data/repository";
import { createClient } from "@/src/lib/supabase/server";

export async function updateDailyGoals(formData: FormData) {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);

  const dailyNewLimit = Number(formData.get("dailyNewLimit") ?? 10);
  const dailyReviewGoal = Number(formData.get("dailyReviewGoal") ?? 50);

  await upsertUserSettings(supabase, userId, {
    daily_new_limit: Math.max(0, Math.min(200, Math.floor(dailyNewLimit))),
    daily_review_goal: Math.max(0, Math.min(500, Math.floor(dailyReviewGoal))),
  });

  redirect("/settings?saved=1");
}
