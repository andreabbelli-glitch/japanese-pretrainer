import type {
  KanjiClashEligibleReviewState,
  KanjiClashEligibleSubject,
  KanjiClashEligibleSubjectMember
} from "./types.ts";
import { dedupeStable } from "./shared-utils.ts";
import {
  collectKanjiFromSurfaces,
  normalizeKanjiClashSurface
} from "./utils.ts";

export type EligibleKanjiClashSubjectRow = {
  canonicalEntryId: string | null;
  crossMediaGroupId: string | null;
  entryId: string;
  lemma: string;
  meaningIt: string;
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  reading: string;
  reps: number | string;
  reviewState: KanjiClashEligibleReviewState;
  stability: number | string;
  subjectKey: string;
  subjectType: "entry" | "group";
};

export function mapEligibleKanjiClashSubjectRows(
  rows: EligibleKanjiClashSubjectRow[]
): KanjiClashEligibleSubject[] {
  const subjects = new Map<string, KanjiClashEligibleSubject>();

  for (const row of rows) {
    const member: KanjiClashEligibleSubjectMember = {
      entryId: row.entryId,
      lemma: row.lemma,
      meaningIt: row.meaningIt,
      mediaId: row.mediaId,
      mediaSlug: row.mediaSlug,
      mediaTitle: row.mediaTitle,
      reading: row.reading
    };
    const existing = subjects.get(row.subjectKey);

    if (existing) {
      if (
        !existing.members.some(
          (currentMember) => currentMember.entryId === member.entryId
        )
      ) {
        existing.members.push(member);
      }

      continue;
    }

    subjects.set(row.subjectKey, {
      entryType: "term",
      kanji: [],
      label: row.lemma,
      members: [member],
      reading: row.reading,
      readingForms: [],
      reps: Number(row.reps),
      reviewState: row.reviewState,
      source:
        row.subjectType === "group" && row.crossMediaGroupId
          ? {
              crossMediaGroupId: row.crossMediaGroupId,
              type: "group" as const
            }
          : {
              entryId: row.canonicalEntryId ?? row.entryId,
              type: "entry" as const
            },
      stability: Number(row.stability),
      subjectKey: row.subjectKey,
      surfaceForms: []
    });
  }

  return [...subjects.values()]
    .map((subject) => finalizeEligibleKanjiClashSubject(subject))
    .filter((subject): subject is KanjiClashEligibleSubject => subject !== null)
    .sort((left, right) => left.subjectKey.localeCompare(right.subjectKey));
}

function finalizeEligibleKanjiClashSubject(
  subject: KanjiClashEligibleSubject
): KanjiClashEligibleSubject | null {
  const members = [...subject.members].sort((left, right) => {
    const mediaDifference = left.mediaSlug.localeCompare(right.mediaSlug);

    if (mediaDifference !== 0) {
      return mediaDifference;
    }

    return left.entryId.localeCompare(right.entryId);
  });
  const surfaceForms = dedupeStable(
    members.map((member) => normalizeKanjiClashSurface(member.lemma))
  );
  const readingForms = dedupeStable(
    members
      .map((member) => normalizeKanjiClashSurface(member.reading))
      .filter((reading) => reading.length > 0)
  );
  const kanji = collectKanjiFromSurfaces(surfaceForms);

  if (kanji.length === 0) {
    return null;
  }

  return {
    ...subject,
    kanji,
    label: members[0]?.lemma ?? subject.label,
    members,
    reading: members[0]?.reading ?? subject.reading ?? null,
    readingForms,
    surfaceForms
  };
}
