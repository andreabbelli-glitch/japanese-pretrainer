"use client";

import { useState } from "react";

type FuriganaToggleProps = {
  japanese: string;
  reading: string;
  className?: string;
};

export function FuriganaToggle({ japanese, reading, className }: FuriganaToggleProps) {
  const [showFurigana, setShowFurigana] = useState(true);

  return (
    <div className={className}>
      <button
        type="button"
        className="mb-2 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
        onClick={() => setShowFurigana((value) => !value)}
      >
        {showFurigana ? "Nascondi lettura" : "Mostra lettura"}
      </button>
      <p className="text-xl font-semibold leading-relaxed text-slate-900">{japanese}</p>
      {showFurigana ? <p className="text-sm text-slate-600">{reading}</p> : null}
    </div>
  );
}
