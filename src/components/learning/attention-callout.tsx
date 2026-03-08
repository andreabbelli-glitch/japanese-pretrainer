export function AttentionCallout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <aside className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">{title}</p>
      <div className="mt-1">{children}</div>
    </aside>
  );
}
