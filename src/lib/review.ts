import { unstable_noStore as noStore } from "next/cache";

import {
  db,
  getCardById,
  getGrammarEntryById,
  getMediaBySlug,
  getTermEntryById,
  type DatabaseClient
} from "@/db";
import {
  mediaGlossaryEntryHref,
  mediaHref,
  mediaStudyHref
} from "@/lib/site";
import {
  capitalizeToken,
  formatCardRelationshipLabel,
  formatReviewStateLabel
} from "@/lib/study-format";
import { getRenderSafeText } from "@/lib/render-safe-text";

type ReviewCardEntryKind = "term" | "grammar";

export type ReviewCardDetailData = {
  card: {
    back: string;
    dueLabel?: string;
    front: string;
    id: string;
    notes?: string;
    reviewLabel: string;
    segmentTitle?: string;
    typeLabel: string;
  };
  entries: Array<{
    href: ReturnType<typeof mediaGlossaryEntryHref>;
    id: string;
    kind: ReviewCardEntryKind;
    label: string;
    meaning: string;
    relationshipLabel: string;
    subtitle?: string;
  }>;
  media: {
    glossaryHref: ReturnType<typeof mediaStudyHref>;
    href: ReturnType<typeof mediaHref>;
    reviewHref: ReturnType<typeof mediaStudyHref>;
    slug: string;
    title: string;
  };
};

export async function getReviewCardDetailData(
  mediaSlug: string,
  cardId: string,
  database: DatabaseClient = db
): Promise<ReviewCardDetailData | null> {
  noStore();

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const loadedCard = await getCardById(database, cardId);

  if (!loadedCard || loadedCard.mediaId !== media.id || loadedCard.status !== "active") {
    return null;
  }

  const entries = await Promise.all(
    loadedCard.entryLinks
      .slice()
      .sort((left, right) => {
        const leftRank = getRelationshipRank(left.relationshipType);
        const rightRank = getRelationshipRank(right.relationshipType);

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        if (left.entryType !== right.entryType) {
          return left.entryType.localeCompare(right.entryType);
        }

        return left.entryId.localeCompare(right.entryId);
      })
      .map(async (link) => {
        if (link.entryType === "term") {
          const entry = await getTermEntryById(database, link.entryId);

          if (!entry || entry.mediaId !== media.id) {
            return null;
          }

          return {
            href: mediaGlossaryEntryHref(media.slug, "term", entry.id),
            id: entry.id,
            kind: "term" as const,
            label: entry.lemma,
            meaning: entry.meaningIt,
            relationshipLabel: formatCardRelationshipLabel(link.relationshipType),
            subtitle: [entry.reading, entry.romaji].filter(Boolean).join(" / ")
          };
        }

        const entry = await getGrammarEntryById(database, link.entryId);

        if (!entry || entry.mediaId !== media.id) {
          return null;
        }

        return {
          href: mediaGlossaryEntryHref(media.slug, "grammar", entry.id),
          id: entry.id,
          kind: "grammar" as const,
          label: entry.pattern,
          meaning: entry.meaningIt,
          relationshipLabel: formatCardRelationshipLabel(link.relationshipType),
          subtitle: entry.title !== entry.pattern ? entry.title : undefined
        };
      })
  );

  return {
    card: {
      back: loadedCard.back,
      dueLabel: loadedCard.reviewState?.dueAt
        ? `Scadenza ${loadedCard.reviewState.dueAt.slice(0, 10)}`
        : undefined,
      front: loadedCard.front,
      id: loadedCard.id,
      notes: getRenderSafeText(loadedCard.notesIt),
      reviewLabel: formatReviewStateLabel(
        loadedCard.reviewState?.state ?? null,
        loadedCard.reviewState?.manualOverride ?? false
      ),
      segmentTitle: loadedCard.segment?.title ?? undefined,
      typeLabel: capitalizeToken(loadedCard.cardType)
    },
    entries: entries.filter((entry) => entry !== null),
    media: {
      glossaryHref: mediaStudyHref(media.slug, "glossary"),
      href: mediaHref(media.slug),
      reviewHref: mediaStudyHref(media.slug, "review"),
      slug: media.slug,
      title: media.title
    }
  };
}

function getRelationshipRank(value: string) {
  const ranks: Record<string, number> = {
    primary: 0,
    secondary: 1,
    context: 2
  };

  return ranks[value] ?? 99;
}
