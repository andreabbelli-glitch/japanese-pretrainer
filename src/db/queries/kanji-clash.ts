import type { DatabaseQueryClient } from "../client.ts";
import type { KanjiClashEligibleSubject } from "../../lib/kanji-clash/types.ts";
import {
  mapEligibleKanjiClashSubjectRows,
  type EligibleKanjiClashSubjectRow
} from "../../lib/kanji-clash/eligible-subject-mapper.ts";

import { buildListEligibleKanjiClashSubjectsSql } from "./kanji-clash-eligibility-policy.ts";

export async function listEligibleKanjiClashSubjects(
  database: DatabaseQueryClient,
  options: {
    mediaIds?: string[];
  } = {}
): Promise<KanjiClashEligibleSubject[]> {
  const rows = await database.all<EligibleKanjiClashSubjectRow>(
    buildListEligibleKanjiClashSubjectsSql(options)
  );

  return mapEligibleKanjiClashSubjectRows(rows);
}
