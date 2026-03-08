import { notFound, redirect } from 'next/navigation';
import { getProducts } from '@/src/domain/content';

export default async function DeckRedirectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProducts().find((entry) => entry.slug === slug);

  if (!product) {
    notFound();
  }

  redirect(`/games/${product.gameId}/products/${product.id}`);
}
