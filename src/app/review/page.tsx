import Link from "next/link";

import { ReviewPage } from "@/components/review/review-page";
import { EmptyState } from "@/components/ui/empty-state";
import { db, listMedia, listReviewCardsByMediaIds } from "@/db";
import { getGlobalReviewPageData } from "@/lib/review";

export const dynamic = "force-dynamic";

type ReviewRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReviewRoute({ searchParams }: ReviewRouteProps) {
  const media = await listMedia(db);

  if (media.length === 0) {
    return (
      <div className="dashboard-page">
        <EmptyState
          eyebrow="Review globale"
          title="Non ci sono ancora media importati."
          description="Importa un bundle per far nascere la review globale e iniziare a mettere in coda le prime card."
          action={
            <Link className="button button--primary" href="/media">
              Apri libreria
            </Link>
          }
        />
      </div>
    );
  }

  const reviewCards = await listReviewCardsByMediaIds(
    db,
    media.map((item) => item.id)
  );

  if (reviewCards.length === 0) {
    return (
      <div className="dashboard-page">
        <EmptyState
          eyebrow="Review globale"
          title="La review globale è pronta, ma non ci sono ancora card attive."
          description="Aggiungi card nuove o riattiva una voce dal Glossary: qui comparirà la queue globale appena ci saranno contenuti da lavorare."
          action={
            <Link className="button button--primary" href="/media">
              Apri libreria
            </Link>
          }
        />
      </div>
    );
  }

  const reviewData = await getGlobalReviewPageData(await searchParams);

  return <ReviewPage data={reviewData} />;
}
