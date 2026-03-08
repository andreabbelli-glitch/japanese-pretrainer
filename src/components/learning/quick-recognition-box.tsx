export function QuickRecognitionBox({ prompt, clues }: { prompt: string; clues: string[] }) {
  return (
    <section className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Riconoscimento rapido</h3>
      <p className="text-sm font-medium text-emerald-900">{prompt}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-900">
        {clues.map((clue) => (
          <li key={clue}>{clue}</li>
        ))}
      </ul>
    </section>
  );
}
