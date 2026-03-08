import Link from "next/link";
import { PageShell } from "@/src/components/page-shell";

export default function HomePage() {
  return (
    <PageShell
      title="Studia il giapponese di Duel Masters"
      description="Base tecnica pronta per textbook, review e coverage dei deck DM25-SD1 / DM25-SD2."
    >
      <div className="space-y-3 text-sm text-slate-700">
        <p>Questa istanza include routing base, auth SSR con Supabase e area privata protetta.</p>
        <Link href="/login" className="inline-block rounded-md bg-slate-900 px-3 py-2 text-white">
          Vai al login
        </Link>
      </div>
    </PageShell>
  );
}
