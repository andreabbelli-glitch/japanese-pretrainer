"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import {
  addBookmark,
  findBookmarkByCardId,
  getAuthenticatedUserId,
  removeBookmarkById,
} from "@/src/features/user-data/repository";

export async function addCardBookmark(formData: FormData) {
  const cardId = String(formData.get("cardId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!cardId || !slug) throw new Error("Dati bookmark mancanti");

  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);

  const existing = await findBookmarkByCardId(supabase, userId, cardId);
  if (!existing) {
    await addBookmark(supabase, {
      user_id: userId,
      card_id: cardId,
    });
  }

  redirect(`/cards/${slug}`);
}

export async function removeCardBookmark(formData: FormData) {
  const cardId = String(formData.get("cardId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!cardId || !slug) throw new Error("Dati bookmark mancanti");

  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);

  const existing = await findBookmarkByCardId(supabase, userId, cardId);
  if (existing) {
    await removeBookmarkById(supabase, userId, existing.id);
  }

  redirect(`/cards/${slug}`);
}
