import { redirect } from "next/navigation";

import type {
  GlossaryCardsFilter,
  GlossaryEntryKind,
  GlossarySort,
  GlossaryStudyFilter
} from "@/lib/site";
import { buildGlossaryHref, readInternalHref } from "@/lib/site";

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
  const { mediaSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const redirectHref = buildGlossaryHref({
    baseHref: "/glossary",
    cards: readCardsFilter(resolvedSearchParams.cards),
    entryType: readEntryType(resolvedSearchParams.type),
    media: mediaSlug,
    query: readSearchParam(resolvedSearchParams.q) ?? undefined,
    returnTo: readInternalHref(resolvedSearchParams.returnTo) ?? undefined,
    sort: readGlossarySort(resolvedSearchParams.sort),
    study: readStudyFilter(resolvedSearchParams.study)
  });

  redirect(redirectHref);
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readCardsFilter(
  value: string | string[] | undefined
): GlossaryCardsFilter | undefined {
  const candidate = readSearchParam(value);

  return candidate === "all" ||
    candidate === "with_cards" ||
    candidate === "without_cards"
    ? candidate
    : undefined;
}

function readEntryType(
  value: string | string[] | undefined
): "all" | GlossaryEntryKind | undefined {
  const candidate = readSearchParam(value);

  return candidate === "all" ||
    candidate === "term" ||
    candidate === "grammar"
    ? candidate
    : undefined;
}

function readGlossarySort(
  value: string | string[] | undefined
): GlossarySort | undefined {
  const candidate = readSearchParam(value);

  return candidate === "lesson_order" || candidate === "alphabetical"
    ? candidate
    : undefined;
}

function readStudyFilter(
  value: string | string[] | undefined
): GlossaryStudyFilter | undefined {
  const candidate = readSearchParam(value);

  return candidate === "all" ||
    candidate === "known" ||
    candidate === "review" ||
    candidate === "learning" ||
    candidate === "new" ||
    candidate === "available"
    ? candidate
    : undefined;
}
