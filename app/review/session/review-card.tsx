"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { submitReviewGrade } from "@/app/review/actions";
import type { ReviewRating } from "@/src/domain/review/types";

const SHORTCUT_KEY: Record<string, ReviewRating> = {
  "1": "Again",
  "2": "Hard",
  "3": "Good",
  "4": "Easy",
};

const RATING_HELP: Record<ReviewRating, string> = {
  Again: "Non ricordato / troppo difficile",
  Hard: "Ricordato con fatica",
  Good: "Ricordato correttamente",
  Easy: "Molto facile",
};

export function ReviewCard({
  session,
  item,
  queue,
  index,
  mode,
  goalId,
}: {
  session: { id: string };
  item: { id: string; term: string; reading: string; meaning: string; exampleText: string; template: { promptLabel: string; answerLabel: string } };
  queue: string[];
  index: number;
  mode: string;
  goalId: string | null;
}) {
  const [revealed, setRevealed] = useState(false);
  const [startedAt] = useState(() => Date.now());

  const queueValue = useMemo(() => queue.join(","), [queue]);
  const submitRefs = useRef<Partial<Record<ReviewRating, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!revealed) return;
      const rating = SHORTCUT_KEY[event.key];
      if (!rating) return;

      event.preventDefault();
      const submit = submitRefs.current[rating];
      submit?.click();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, item.id, queueValue, revealed, session.id, startedAt]);

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="rounded-md bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.template.promptLabel}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{item.term}</p>
      </div>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
        >
          Mostra risposta
        </button>
      ) : (
        <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">{item.template.answerLabel}</p>
          <p>
            <span className="font-semibold">Lettura:</span> {item.reading}
          </p>
          <p>
            <span className="font-semibold">Significato:</span> {item.meaning}
          </p>
          <p>
            <span className="font-semibold">Uso:</span> {item.exampleText}
          </p>

          <div className="grid gap-2 md:grid-cols-2">
            {(["Again", "Hard", "Good", "Easy"] as ReviewRating[]).map((rating) => (
              <form key={rating} action={submitReviewGrade}>
                <input type="hidden" name="sessionId" value={session.id} />
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="queue" value={queueValue} />
                <input type="hidden" name="index" value={index} />
                <input type="hidden" name="rating" value={rating} />
                <input type="hidden" name="responseMs" value={Date.now() - startedAt} />
                <input type="hidden" name="mode" value={mode} />
                {goalId ? <input type="hidden" name="goalId" value={goalId} /> : null}
                <button
                  ref={(el) => {
                    submitRefs.current[rating] = el;
                  }}
                  type="submit"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm hover:bg-slate-100"
                >
                  <span className="font-semibold">{rating}</span> — {RATING_HELP[rating]}
                </button>
              </form>
            ))}
          </div>

          <p className="text-xs text-slate-600">Shortcut tastiera: 1 Again · 2 Hard · 3 Good · 4 Easy.</p>
        </div>
      )}
    </section>
  );
}
