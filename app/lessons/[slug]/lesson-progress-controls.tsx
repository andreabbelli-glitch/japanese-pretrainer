"use client";

import { useActionState } from "react";
import { setLessonStatus } from "@/app/lessons/actions";

const initialState: { error?: string; success?: string } = {};

export function LessonProgressControls({
  lessonId,
  lessonSlug,
  currentStatus,
}: {
  lessonId: string;
  lessonSlug: string;
  currentStatus: "not_started" | "in_progress" | "completed";
}) {
  const [state, action, pending] = useActionState(setLessonStatus, initialState);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="lessonSlug" value={lessonSlug} />
      <p className="text-sm font-medium text-slate-900">Stato attuale: {currentStatus.replace("_", " ")}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="status"
          value="in_progress"
          className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
          disabled={pending}
        >
          Segna come in corso
        </button>
        <button
          type="submit"
          name="status"
          value="completed"
          className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
          disabled={pending}
        >
          Segna come completata
        </button>
        <button
          type="submit"
          name="status"
          value="not_started"
          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-60"
          disabled={pending}
        >
          Resetta
        </button>
      </div>
      {state.error ? <p className="text-xs text-rose-700">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-emerald-700">{state.success}</p> : null}
    </form>
  );
}
