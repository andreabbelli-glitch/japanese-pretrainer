import type { ReactNode } from "react";

export function PageShell({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-slate-600">{description}</p>
      </header>
      {children}
    </section>
  );
}
