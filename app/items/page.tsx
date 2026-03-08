import type { Route } from "next";
import Link from "next/link";
import { PageShell } from "@/src/components/page-shell";
import { getItems } from "@/src/domain/content";

export default function ItemsPage() {
  const items = getItems();

  return (
    <PageShell title="Item di studio" description="Glossario canonico dal content graph: kanji, vocab, keyword e pattern.">
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <Link href={`/items/${item.id}` as Route} className="font-semibold text-slate-900 hover:underline">
              {item.id} — {item.term}
            </Link>
            <p className="text-sm text-slate-700">{item.meaning}</p>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
