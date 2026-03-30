import type { Route } from "next";

import type { CrossMediaSibling, EntryLessonConnection } from "@/db";
import { mediaGlossaryEntryHref, mediaTextbookLessonHref } from "@/lib/site";
import { capitalizeToken } from "@/lib/study-format";
import { stripInlineMarkdown } from "@/lib/render-furigana";
import { pickBestBy } from "@/lib/collections";

type GlossaryAlias = {
  text: string;
  type?: string;
};

type AggregatedLessonConnection = {
  lessonId: string;
  lessonOrderIndex: number;
  lessonSlug: string;
  lessonSummary: string | null;
  lessonTitle: string;
  linkRoles: EntryLessonConnection["linkRole"][];
  segmentTitle: string | null;
  sortOrder: number | null;
};

export function aggregateGlossaryLessonConnections(
  rows: EntryLessonConnection[]
) {
  const lessons = new Map<string, AggregatedLessonConnection>();

  for (const row of rows) {
    const existing = lessons.get(row.lessonId);

    if (existing) {
      if (!existing.linkRoles.includes(row.linkRole)) {
        existing.linkRoles.push(row.linkRole);
        existing.linkRoles.sort(
          (left, right) =>
            getGlossaryEntryLinkRoleRank(left) -
            getGlossaryEntryLinkRoleRank(right)
        );
      }

      existing.sortOrder = Math.min(
        existing.sortOrder ?? Number.MAX_SAFE_INTEGER,
        row.sortOrder ?? Number.MAX_SAFE_INTEGER
      );
      continue;
    }

    lessons.set(row.lessonId, {
      lessonId: row.lessonId,
      lessonOrderIndex: row.lessonOrderIndex,
      lessonSlug: row.lessonSlug,
      lessonSummary: row.lessonSummary,
      lessonTitle: row.lessonTitle,
      linkRoles: [row.linkRole],
      segmentTitle: row.segmentTitle,
      sortOrder: row.sortOrder
    });
  }

  return [...lessons.values()].sort((left, right) => {
    const leftRank = getGlossaryEntryLinkRoleRank(left.linkRoles[0]);
    const rightRank = getGlossaryEntryLinkRoleRank(right.linkRoles[0]);

    if (left.lessonOrderIndex !== right.lessonOrderIndex) {
      return left.lessonOrderIndex - right.lessonOrderIndex;
    }

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    if (
      (left.sortOrder ?? Number.MAX_SAFE_INTEGER) !==
      (right.sortOrder ?? Number.MAX_SAFE_INTEGER)
    ) {
      return (
        (left.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.sortOrder ?? Number.MAX_SAFE_INTEGER)
      );
    }

    return left.lessonTitle.localeCompare(right.lessonTitle);
  });
}

export function pickPrimaryGlossaryLesson(
  rows: AggregatedLessonConnection[],
  mediaSlug: string
): { href: Route; roleLabel: string; title: string } | undefined {
  const primary = pickBestBy(rows, (left, right) => {
    const leftRank = getGlossaryEntryLinkRoleRank(left.linkRoles[0]);
    const rightRank = getGlossaryEntryLinkRoleRank(right.linkRoles[0]);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    if (left.lessonOrderIndex !== right.lessonOrderIndex) {
      return left.lessonOrderIndex - right.lessonOrderIndex;
    }

    return left.lessonTitle.localeCompare(right.lessonTitle);
  });

  if (!primary) {
    return undefined;
  }

  return {
    href: mediaTextbookLessonHref(mediaSlug, primary.lessonSlug),
    roleLabel: formatGlossaryEntryLinkRole(primary.linkRoles[0]),
    title: primary.lessonTitle
  };
}

export function formatGlossaryEntryLinkRole(role: string) {
  const labels: Record<string, string> = {
    introduced: "Introdotta",
    explained: "Spiegata",
    mentioned: "Citata",
    reviewed: "Ripassata"
  };

  return labels[role] ?? capitalizeToken(role);
}

export function formatGlossaryShortDate(value: string) {
  return value.slice(0, 10);
}

export function groupAliasesForGlossaryDetail(aliases: GlossaryAlias[]) {
  const groups = new Map<string, string[]>();

  for (const alias of aliases) {
    const key =
      alias.type === "reading"
        ? "Letture"
        : alias.type === "romaji"
          ? "Romaji"
          : "Alias";
    const existing = groups.get(key);

    if (existing) {
      if (!existing.includes(alias.text)) {
        existing.push(alias.text);
      }
      continue;
    }

    groups.set(key, [alias.text]);
  }

  return [...groups.entries()].map(([label, values]) => ({
    label,
    values
  }));
}

export function mapGlossaryCrossMediaSibling(sibling: CrossMediaSibling) {
  return {
    href: mediaGlossaryEntryHref(
      sibling.mediaSlug,
      sibling.kind,
      sibling.sourceId
    ),
    kind: sibling.kind,
    label: sibling.label,
    reading: sibling.reading ?? undefined,
    romaji: sibling.kind === "term" ? sibling.romaji : undefined,
    meaning: sibling.meaningIt,
    mediaSlug: sibling.mediaSlug,
    mediaTitle: sibling.mediaTitle,
    notes: buildCrossMediaNotesPreview(sibling.notesIt),
    title:
      sibling.kind === "grammar" &&
      sibling.title &&
      sibling.title !== sibling.label
        ? sibling.title
        : undefined,
    segmentTitle: sibling.segmentTitle ?? undefined
  };
}

function getGlossaryEntryLinkRoleRank(role: EntryLessonConnection["linkRole"]) {
  const ranks: Record<EntryLessonConnection["linkRole"], number> = {
    introduced: 0,
    explained: 1,
    mentioned: 2,
    reviewed: 3
  };

  return ranks[role];
}

function buildCrossMediaNotesPreview(notes?: string | null) {
  if (!notes) {
    return undefined;
  }

  const plainText = stripInlineMarkdown(notes).replace(/\s+/g, " ").trim();

  if (plainText.length === 0) {
    return undefined;
  }

  if (plainText.length <= 180) {
    return plainText;
  }

  return `${plainText.slice(0, 177).trimEnd()}...`;
}
