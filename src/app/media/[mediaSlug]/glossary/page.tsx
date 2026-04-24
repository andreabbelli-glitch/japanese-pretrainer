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
    page: readPositiveIntegerSearchParam(resolvedSearchParams.page),
    query: readSearchParam(resolvedSearchParams.q) ?? undefined,
    returnTo: readInternalHref(resolvedSearchParams.returnTo) ?? undefined,
    segmentId: readSearchParam(resolvedSearchParams.segment) ?? undefined,
    sort: readGlossarySort(resolvedSearchParams.sort),
    study: readStudyFilter(resolvedSearchParams.study)
  });

  redirect(redirectHref);
}

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return (
      value
        .find((entry) => typeof entry === "string" && entry.trim().length > 0)
        ?.trim() ?? undefined
    );
  }

  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function readCardsFilter(
  value: string | string[] | undefined
): GlossaryCardsFilter | undefined {
  return readMatchingSearchParam(
    value,
    (candidate): candidate is GlossaryCardsFilter =>
      candidate === "all" ||
      candidate === "with_cards" ||
      candidate === "without_cards"
  );
}

function readEntryType(
  value: string | string[] | undefined
): "all" | GlossaryEntryKind | undefined {
  return readMatchingSearchParam(
    value,
    (candidate): candidate is "all" | GlossaryEntryKind =>
      candidate === "all" || candidate === "term" || candidate === "grammar"
  );
}

function readGlossarySort(
  value: string | string[] | undefined
): GlossarySort | undefined {
  return readMatchingSearchParam(
    value,
    (candidate): candidate is GlossarySort =>
      candidate === "lesson_order" || candidate === "alphabetical"
  );
}

function readStudyFilter(
  value: string | string[] | undefined
): GlossaryStudyFilter | undefined {
  return readMatchingSearchParam(
    value,
    (candidate): candidate is GlossaryStudyFilter =>
      candidate === "all" ||
      candidate === "known" ||
      candidate === "review" ||
      candidate === "learning" ||
      candidate === "new" ||
      candidate === "available"
  );
}

function readPositiveIntegerSearchParam(value: string | string[] | undefined) {
  const parsed = readMatchingSearchParam(
    value,
    (candidate): candidate is string => {
      if (!/^\d+$/u.test(candidate)) {
        return false;
      }

      const page = Number.parseInt(candidate, 10);

      return Number.isSafeInteger(page) && page > 0;
    }
  );

  return parsed ? Number.parseInt(parsed, 10) : undefined;
}

function readMatchingSearchParam<T extends string>(
  value: string | string[] | undefined,
  matcher: (candidate: string) => candidate is T
): T | undefined {
  const candidates = Array.isArray(value) ? value : [value];

  for (const entry of candidates) {
    const trimmed = entry?.trim();

    if (!trimmed) {
      continue;
    }

    if (matcher(trimmed)) {
      return trimmed;
    }
  }

  return undefined;
}
