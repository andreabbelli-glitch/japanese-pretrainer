type SentenceChunk = {
  part: string;
  explanation: string;
};

export function SentenceBreakdown({ sentence, chunks }: { sentence: string; chunks: SentenceChunk[] }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Segmentazione didattica</h3>
      <p className="text-lg font-medium text-slate-900">{sentence}</p>
      <ul className="space-y-2 text-sm text-slate-700">
        {chunks.map((chunk) => (
          <li key={chunk.part} className="rounded-md bg-white p-3">
            <p className="font-semibold text-slate-900">{chunk.part}</p>
            <p>{chunk.explanation}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
