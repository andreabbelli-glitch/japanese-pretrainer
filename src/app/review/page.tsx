import Link from "next/link";
import { redirect } from "next/navigation";

import { getDashboardData } from "@/lib/app-shell";
import { mediaStudyHref } from "@/lib/site";

import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { reviewMedia } = await getDashboardData();

  if (reviewMedia) {
    redirect(mediaStudyHref(reviewMedia.slug, "review"));
  }

  return (
    <div className="dashboard-page">
      <EmptyState
        eyebrow="Review"
        title="Non ci sono ancora media pronti per la review."
        description="Importa almeno un bundle con card reali, poi questo ingresso ti porterà direttamente alla sessione del media più naturale da riprendere."
        action={
          <Link className="button button--primary" href="/media">
            Apri libreria
          </Link>
        }
      />
    </div>
  );
}
