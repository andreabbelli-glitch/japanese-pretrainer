import Link from 'next/link';
import { PageShell } from '@/src/components/page-shell';

export default function HomePage() {
  return (
    <PageShell
      title="Studia giapponese TCG in modo content-first"
      description="Dominio canonico game/product/unit con coverage e gap analysis target-aware."
    >
      <div className="space-y-3 text-sm text-slate-700">
        <p>Questa istanza include routing generico multi-contesto, auth SSR con Supabase e area privata protetta.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/games" className="inline-block rounded-md bg-slate-900 px-3 py-2 text-white">
            Vai ai giochi
          </Link>
          <Link href="/login" className="inline-block rounded-md border border-slate-300 px-3 py-2">
            Login
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
