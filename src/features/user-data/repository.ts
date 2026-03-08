/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Database } from "@/src/lib/supabase/database.types";

type DbClient = any;
type Tables = Database["public"]["Tables"];

export type UserSettingsRow = Tables["user_settings"]["Row"];
export type LessonProgressRow = Tables["lesson_progress"]["Row"];
export type UserItemProgressRow = Tables["user_item_progress"]["Row"];
export type ReviewSessionRow = Tables["review_sessions"]["Row"];
export type ReviewEventRow = Tables["review_events"]["Row"];
export type BookmarkRow = Tables["bookmarks"]["Row"];

export async function getAuthenticatedUserId(supabase: DbClient): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Utente non autenticato.");
  }

  return user.id;
}

export async function getUserSettings(supabase: DbClient, userId: string): Promise<UserSettingsRow | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertUserSettings(
  supabase: DbClient,
  userId: string,
  settings: Partial<Omit<Tables["user_settings"]["Insert"], "user_id">>,
): Promise<UserSettingsRow> {
  const payload: Tables["user_settings"]["Insert"] = { user_id: userId, ...settings };
  const { data, error } = await supabase
    .from("user_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getLessonProgress(
  supabase: DbClient,
  userId: string,
  lessonId: string,
): Promise<LessonProgressRow | null> {
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertLessonProgress(
  supabase: DbClient,
  payload: Tables["lesson_progress"]["Insert"],
): Promise<LessonProgressRow> {
  const { data, error } = await supabase
    .from("lesson_progress")
    .upsert(payload, { onConflict: "user_id,lesson_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getUserItemProgress(
  supabase: DbClient,
  userId: string,
  itemId: string,
): Promise<UserItemProgressRow | null> {
  const { data, error } = await supabase
    .from("user_item_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getUserItemProgressByItemIds(
  supabase: DbClient,
  userId: string,
  itemIds: string[],
): Promise<UserItemProgressRow[]> {
  if (itemIds.length === 0) return [];

  const { data, error } = await supabase
    .from("user_item_progress")
    .select("*")
    .eq("user_id", userId)
    .in("item_id", itemIds);

  if (error) throw error;
  return data;
}

export async function getDueReviewItems(
  supabase: DbClient,
  userId: string,
  limit = 20,
): Promise<UserItemProgressRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_item_progress")
    .select("*")
    .eq("user_id", userId)
    .lte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function listUserItemProgress(supabase: DbClient, userId: string): Promise<UserItemProgressRow[]> {
  const { data, error } = await supabase.from("user_item_progress").select("*").eq("user_id", userId);

  if (error) throw error;
  return data;
}

export async function upsertUserItemProgress(
  supabase: DbClient,
  payload: Tables["user_item_progress"]["Insert"],
): Promise<UserItemProgressRow> {
  const { data, error } = await supabase
    .from("user_item_progress")
    .upsert(payload, { onConflict: "user_id,item_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function createReviewSession(
  supabase: DbClient,
  payload: Tables["review_sessions"]["Insert"],
): Promise<ReviewSessionRow> {
  const { data, error } = await supabase.from("review_sessions").insert(payload).select("*").single();

  if (error) throw error;
  return data;
}

export async function updateReviewSession(
  supabase: DbClient,
  sessionId: string,
  userId: string,
  patch: Tables["review_sessions"]["Update"],
): Promise<ReviewSessionRow> {
  const { data, error } = await supabase
    .from("review_sessions")
    .update(patch)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function insertReviewEvent(
  supabase: DbClient,
  payload: Tables["review_events"]["Insert"],
): Promise<ReviewEventRow> {
  const { data, error } = await supabase.from("review_events").insert(payload).select("*").single();

  if (error) throw error;
  return data;
}

export async function listReviewEventsBySession(
  supabase: DbClient,
  userId: string,
  sessionId: string,
): Promise<ReviewEventRow[]> {
  const { data, error } = await supabase
    .from("review_events")
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function listRecentReviewEvents(supabase: DbClient, userId: string, limit = 100): Promise<ReviewEventRow[]> {
  const { data, error } = await supabase
    .from("review_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function listLessonProgressByUser(supabase: DbClient, userId: string): Promise<LessonProgressRow[]> {
  const { data, error } = await supabase.from("lesson_progress").select("*").eq("user_id", userId);

  if (error) throw error;
  return data;
}

export async function listRecentReviewSessions(supabase: DbClient, userId: string, limit = 30): Promise<ReviewSessionRow[]> {
  const { data, error } = await supabase
    .from("review_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function findBookmarkByCardId(supabase: DbClient, userId: string, cardId: string): Promise<BookmarkRow | null> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .eq("card_id", cardId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listBookmarks(supabase: DbClient, userId: string): Promise<BookmarkRow[]> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function addBookmark(
  supabase: DbClient,
  payload: Tables["bookmarks"]["Insert"],
): Promise<BookmarkRow> {
  const { data, error } = await supabase.from("bookmarks").insert(payload).select("*").single();

  if (error) throw error;
  return data;
}

export async function removeBookmarkById(supabase: DbClient, userId: string, bookmarkId: string): Promise<void> {
  const { error } = await supabase.from("bookmarks").delete().eq("user_id", userId).eq("id", bookmarkId);

  if (error) throw error;
}
