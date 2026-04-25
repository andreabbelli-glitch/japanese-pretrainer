import { notFound } from "next/navigation";


type GlossaryGrammarDetailRouteProps = {
  params: Promise<{
    entryId: string;
    mediaSlug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GlossaryGrammarDetailRoute({
  params,
  searchParams
}: GlossaryGrammarDetailRouteProps) {
  await Promise.all([params, searchParams]);
  notFound();
}
