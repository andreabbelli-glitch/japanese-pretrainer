import { notFound, redirect } from 'next/navigation';
import { getSourceUnits } from '@/src/domain/content';

export default async function CardRedirectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const unit = getSourceUnits().find((entry) => entry.slug === slug);

  if (!unit) {
    notFound();
  }

  redirect(`/games/${unit.gameId}/products/${unit.productId}/units/${unit.id}`);
}
