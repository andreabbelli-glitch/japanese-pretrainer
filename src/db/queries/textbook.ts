import { and, asc, eq } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import { entryLink } from "../schema/index.ts";

const lessonEntryLinkColumns = {
  entryId: true,
  entryType: true
} as const;

export async function listLessonEntryLinks(
  database: DatabaseClient,
  lessonId: string
) {
  return database.query.entryLink.findMany({
    columns: lessonEntryLinkColumns,
    where: and(
      eq(entryLink.sourceType, "lesson"),
      eq(entryLink.sourceId, lessonId)
    ),
    orderBy: [
      asc(entryLink.sortOrder),
      asc(entryLink.entryType),
      asc(entryLink.entryId)
    ]
  });
}
