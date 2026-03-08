"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/src/lib/supabase/server";
import { getAuthenticatedUserId, upsertLessonProgress } from "@/src/features/user-data/repository";

type ProgressActionState = {
  error?: string;
  success?: string;
};

export async function setLessonStatus(_prevState: ProgressActionState, formData: FormData): Promise<ProgressActionState> {
  const lessonId = formData.get("lessonId");
  const lessonSlug = formData.get("lessonSlug");
  const status = formData.get("status");

  if (typeof lessonId !== "string" || typeof lessonSlug !== "string") {
    return { error: "Dati lezione non validi." };
  }

  if (status !== "not_started" && status !== "in_progress" && status !== "completed") {
    return { error: "Stato lezione non valido." };
  }

  try {
    const supabase = await createClient();
    const userId = await getAuthenticatedUserId(supabase);

    await upsertLessonProgress(supabase, {
      user_id: userId,
      lesson_id: lessonId,
      status,
      started_at: status === "not_started" ? null : new Date().toISOString(),
      completed_at: status === "completed" ? new Date().toISOString() : null,
    });

    revalidatePath("/lessons");
    revalidatePath(`/lessons/${lessonSlug}`);

    return { success: "Progresso lezione aggiornato." };
  } catch {
    return { error: "Per salvare il progresso devi effettuare il login." };
  }
}
