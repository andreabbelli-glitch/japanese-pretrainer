import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";

import type { DatabaseClient } from "@/db";
import { term } from "@/db/schema";
import { developmentFixture } from "@/db/seed";
import { mediaGlossaryEntryHref } from "@/features/navigation";
import { buildReviewMemoryKey } from "@/features/review/model/recall-task";
import { crossMediaFixture } from "./cross-media-fixture";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const reviewValidContentRoot = path.join(
  __dirname,
  "..",
  "fixtures",
  "content",
  "valid",
  "content"
);

export const primaryCanonicalSubjectKey = `entry:term:${developmentFixture.termDbId}`;
export const primarySubjectKey = buildReviewMemoryKey({
  canonicalSubjectKey: primaryCanonicalSubjectKey,
  cardId: developmentFixture.primaryCardId,
  recallTask: "recognition"
});
export const secondaryCanonicalSubjectKey = `entry:grammar:${developmentFixture.grammarDbId}`;
export const secondarySubjectKey = buildReviewMemoryKey({
  canonicalSubjectKey: secondaryCanonicalSubjectKey,
  cardId: developmentFixture.secondaryCardId,
  recallTask: "other"
});

export function expectedGlossaryEntryHref(
  mediaSlug: string,
  kind: "term" | "grammar",
  surface: string,
  sourceId: string
) {
  return mediaGlossaryEntryHref(mediaSlug, kind, surface, {
    sourceId
  });
}

export async function loadCrossMediaTermSubjectContext(client: DatabaseClient) {
  const [alphaTermEntry, betaTermEntry] = await Promise.all([
    client.query.term.findFirst({
      where: eq(term.sourceId, crossMediaFixture.alpha.termSourceId)
    }),
    client.query.term.findFirst({
      where: eq(term.sourceId, crossMediaFixture.beta.termSourceId)
    })
  ]);

  if (
    !alphaTermEntry ||
    !betaTermEntry ||
    !alphaTermEntry.crossMediaGroupId ||
    !betaTermEntry.crossMediaGroupId
  ) {
    throw new Error("Cross-media term fixture is missing its canonical group.");
  }

  return {
    alphaTermEntry,
    betaTermEntry,
    crossMediaGroupId: alphaTermEntry.crossMediaGroupId,
    canonicalSubjectKey: `group:term:${alphaTermEntry.crossMediaGroupId}`,
    subjectKey: buildReviewMemoryKey({
      canonicalSubjectKey: `group:term:${alphaTermEntry.crossMediaGroupId}`,
      cardId: crossMediaFixture.alpha.termCardId,
      recallTask: "recognition"
    })
  };
}
