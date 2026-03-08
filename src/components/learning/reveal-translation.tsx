"use client";

import { useState } from "react";

export function RevealTranslation({ label = "Parafrasi italiana", translation }: { label?: string; translation: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
      <button
        type="button"
        className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
        onClick={() => setRevealed((value) => !value)}
      >
        {revealed ? `Nascondi ${label.toLowerCase()}` : `Mostra ${label.toLowerCase()}`}
      </button>
      {revealed ? <p className="text-sm text-slate-700">{translation}</p> : null}
    </div>
  );
}
