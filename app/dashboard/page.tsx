import { PageShell } from "@/src/components/page-shell";
import { logout } from "@/app/login/actions";

export default function DashboardPage() {
  return (
    <PageShell title="Dashboard" description="Area privata: panoramica progresso (placeholder v1 foundation).">
      <form action={logout}>
        <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          Logout
        </button>
      </form>
    </PageShell>
  );
}
