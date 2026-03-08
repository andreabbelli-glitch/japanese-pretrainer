import Link from "next/link";
import type { StudyItem } from "@/src/domain/content";

export function RelatedItemsList({ items }: { items: StudyItem[] }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Item collegati</h3>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id} className="rounded-md bg-slate-50 p-3">
            <Link href={`/items/${item.id}`} className="font-semibold text-slate-900 hover:underline">
              {item.id} — {item.term}
            </Link>
            <p className="text-slate-700">{item.meaning}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
