import { notFound } from "next/navigation";

type GlossaryRouteProps = {
  params: Promise<{
    mediaSlug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MediaGlossaryRoute({
  params,
  searchParams
}: GlossaryRouteProps) {
  await Promise.all([params, searchParams]);
  notFound();
}
