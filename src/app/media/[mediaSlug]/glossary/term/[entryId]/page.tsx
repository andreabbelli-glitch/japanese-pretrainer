import { notFound } from "next/navigation";


type GlossaryTermDetailRouteProps = {
  params: Promise<{
    entryId: string;
    mediaSlug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GlossaryTermDetailRoute({
  params,
  searchParams
}: GlossaryTermDetailRouteProps) {
  await Promise.all([params, searchParams]);
  notFound();
}
