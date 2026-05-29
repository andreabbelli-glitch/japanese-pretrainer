import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";

import type { DatabaseClient } from "@/db";
import { term } from "@/db/schema";
import { developmentFixture } from "@/db/seed";
import { mediaGlossaryEntryHref } from "@/features/navigation";
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

export const primarySubjectKey = `entry:term:${developmentFixture.termDbId}`;
export const secondarySubjectKey = `entry:grammar:${developmentFixture.grammarDbId}`;

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
    subjectKey: `group:term:${alphaTermEntry.crossMediaGroupId}`
  };
}
