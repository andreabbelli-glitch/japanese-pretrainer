"use server";

import { redirect } from "next/navigation";
import { getItemById, getItems } from "@/src/domain/content";
import { applyRating } from "@/src/domain/review/transitions";
import { buildSessionQueue } from "@/src/domain/review/queue";
import { getDueQueueEntries, getNewQueueEntries, getReviewSettings, toSnapshot } from "@/src/domain/review/queries";
import type { ReviewRating } from "@/src/domain/review/types";
import {
  createReviewSession,
  getAuthenticatedUserId,
  getUserItemProgress,
  insertReviewEvent,
  listReviewEventsBySession,
  updateReviewSession,
  upsertUserItemProgress,
} from "@/src/features/user-data/repository";
import { createClient } from "@/src/lib/supabase/server";

const RATINGS: ReviewRating[] = ["Again", "Hard", "Good", "Easy"];

function normalizeRating(value: FormDataEntryValue | null): ReviewRating {
  if (typeof value !== "string" || !RATINGS.includes(value as ReviewRating)) {
    throw new Error("Rating non valido.");
  }

  return value as ReviewRating;
}

export async function startReviewSession() {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);

  const settings = await getReviewSettings(supabase, userId);
  const dueEntries = await getDueQueueEntries(supabase, userId, Math.max(settings.dailyReviewGoal, 1));
  const newEntries = await getNewQueueEntries(supabase, userId, Math.max(settings.dailyNewLimit, 1));

  const queuePlan = buildSessionQueue({
    dueItems: dueEntries,
    newItems: newEntries,
    dailyReviewGoal: settings.dailyReviewGoal,
    dailyNewLimit: settings.dailyNewLimit,
  });

  if (queuePlan.totalPlanned === 0) {
    redirect("/review?empty=1");
  }

  const session = await createReviewSession(supabase, {
    user_id: userId,
    status: "active",
    item_count: queuePlan.totalPlanned,
    reviewed_count: 0,
    content_version: "v1",
  });

  const queue = [...queuePlan.due, ...queuePlan.newItems].map((entry) => entry.itemId);
  redirect(`/review/session?sessionId=${session.id}&queue=${queue.join(",")}&index=0`);
}

export async function submitReviewGrade(formData: FormData) {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);

  const sessionId = String(formData.get("sessionId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const queueRaw = String(formData.get("queue") ?? "");
  const index = Number(formData.get("index") ?? 0);
  const responseMs = Number(formData.get("responseMs") ?? 0);
  const rating = normalizeRating(formData.get("rating"));

  if (!sessionId || !itemId || !queueRaw) {
    throw new Error("Dati sessione mancanti.");
  }

  const item = getItemById(itemId);
  if (!item) {
    throw new Error("Item review non trovato nel content graph.");
  }

  const existing = await getUserItemProgress(supabase, userId, itemId);
  const before = existing
    ? toSnapshot(existing)
    : {
        itemId,
        state: "new" as const,
        dueAt: null,
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 0,
        lapses: 0,
        streak: 0,
        masteryScore: 0,
        lastRating: null,
      };

  const next = applyRating(before, rating);
  await upsertUserItemProgress(supabase, {
    user_id: userId,
    item_id: itemId,
    state: next.nextState,
    due_at: next.dueAt.toISOString(),
    last_reviewed_at: new Date().toISOString(),
    interval_days: next.intervalDays,
    ease_factor: next.easeFactor,
    reps: next.reps,
    lapses: next.lapses,
    streak: next.streak,
    mastery_score: next.masteryScore,
    last_rating: rating,
    content_version: "v1",
  });

  await insertReviewEvent(supabase, {
    user_id: userId,
    session_id: sessionId,
    item_id: itemId,
    rating,
    previous_state: before.state,
    next_state: next.nextState,
    interval_days_after: next.intervalDays,
    ease_factor_after: next.easeFactor,
    due_at_after: next.dueAt.toISOString(),
    response_ms: Number.isFinite(responseMs) ? responseMs : null,
    content_version: "v1",
  });

  const events = await listReviewEventsBySession(supabase, userId, sessionId);
  const counts = events.reduce(
    (acc, event) => {
      acc[event.rating] += 1;
      return acc;
    },
    { Again: 0, Hard: 0, Good: 0, Easy: 0 },
  );

  await updateReviewSession(supabase, sessionId, userId, {
    reviewed_count: events.length,
    again_count: counts.Again,
    hard_count: counts.Hard,
    good_count: counts.Good,
    easy_count: counts.Easy,
  });

  const queue = queueRaw.split(",").filter(Boolean);
  const nextIndex = index + 1;

  if (nextIndex >= queue.length) {
    await finishReviewSessionWithSummary(sessionId, userId);
    redirect(`/review/session?sessionId=${sessionId}&done=1`);
  }

  redirect(`/review/session?sessionId=${sessionId}&queue=${queue.join(",")}&index=${nextIndex}`);
}

async function finishReviewSessionWithSummary(sessionId: string, userId: string) {
  const supabase = await createClient();
  const events = await listReviewEventsBySession(supabase, userId, sessionId);
  const counts = events.reduce(
    (acc, event) => {
      acc[event.rating] += 1;
      return acc;
    },
    { Again: 0, Hard: 0, Good: 0, Easy: 0 },
  );

  await updateReviewSession(supabase, sessionId, userId, {
    status: "completed",
    ended_at: new Date().toISOString(),
    reviewed_count: events.length,
    again_count: counts.Again,
    hard_count: counts.Hard,
    good_count: counts.Good,
    easy_count: counts.Easy,
  });
}

export async function finishReviewSession(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) {
    redirect("/review");
  }

  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);
  await finishReviewSessionWithSummary(sessionId, userId);
  redirect(`/review/session?sessionId=${sessionId}&done=1`);
}

export async function seedItemForReview(formData: FormData) {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);
  const itemId = String(formData.get("itemId") ?? "");

  const item = getItems().find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error("Item non trovato.");
  }

  const now = new Date();
  await upsertUserItemProgress(supabase, {
    user_id: userId,
    item_id: itemId,
    state: "new",
    due_at: now.toISOString(),
    last_reviewed_at: null,
    interval_days: 0,
    ease_factor: 2.5,
    reps: 0,
    lapses: 0,
    streak: 0,
    mastery_score: 0,
    last_rating: null,
    content_version: "v1",
  });

  redirect("/review?seeded=1");
}
