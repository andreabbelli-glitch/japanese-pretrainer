import { describe, expect, it } from "vitest";

import { parseMediaDirectory } from "@/features/content";
import { buildContentEntryUsage } from "@/features/content/tooling/entry-usage";

import { validMediaDirectory } from "./helpers/content-fixtures";

describe("content entry usage tooling", () => {
  it("reports canonical cards and all semantic term references with line numbers", async () => {
    const result = await parseMediaDirectory(validMediaDirectory);

    expect(result.ok).toBe(true);

    const usage = buildContentEntryUsage({
      bundles: [result.data],
      entryId: "term-taberu",
      mediaSlug: "sample-anime",
      repositoryRoot: process.cwd()
    });

    expect("error" in usage).toBe(false);

    if ("error" in usage) {
      return;
    }

    expect(usage.entry).toMatchObject({
      display: "食べる",
      id: "term-taberu",
      kind: "term",
      reading: "たべる",
      status: "covered-card"
    });
    expect(usage.counts).toEqual({
      cards: 1,
      lessons: 1,
      usages: 2
    });
    expect(usage.cards).toEqual([
      expect.objectContaining({
        id: "card-taberu-recognition",
        lesson_slug: "ep01-intro"
      })
    ]);
    expect(usage.usages).toEqual([
      expect.objectContaining({
        display: "食べる",
        field: "lesson.body",
        lesson_slug: "ep01-intro",
        line: 16
      }),
      expect.objectContaining({
        display: "食べる",
        field: "image.caption",
        lesson_slug: "ep01-intro",
        line: 26
      })
    ]);
  });

  it("corrects body-relative semantic reference lines to full source-file lines", async () => {
    const result = await parseMediaDirectory(validMediaDirectory);

    expect(result.ok).toBe(true);

    const reference = result.data.references.find(
      (item) => item.targetId === "term-taberu"
    )!;

    reference.location = {
      start: {
        column: reference.location!.start.column,
        line: 4
      },
      end: {
        column: reference.location!.end.column,
        line: 4
      }
    };

    const usage = buildContentEntryUsage({
      bundles: [result.data],
      entryId: "term-taberu",
      mediaSlug: "sample-anime",
      repositoryRoot: process.cwd()
    });

    expect("error" in usage).toBe(false);

    if ("error" in usage) {
      return;
    }

    expect(usage.usages[0]).toMatchObject({
      field: "lesson.body",
      line: 16
    });
  });

  it("finds real semantic reference lines after structured block placeholders", async () => {
    const result = await parseMediaDirectory("content/media/crystal-hunters");

    expect(result.ok).toBe(true);

    const usage = buildContentEntryUsage({
      bundles: [result.data],
      entryId: "term-miru",
      mediaSlug: "crystal-hunters",
      repositoryRoot: process.cwd(),
      usageLimit: 10
    });

    expect("error" in usage).toBe(false);

    if ("error" in usage) {
      return;
    }

    expect(usage.usages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "lesson.body",
          lesson_slug: "book-1-l01-sword-pronouns-and-first-movement",
          line: 84
        }),
        expect.objectContaining({
          field: "lesson.body",
          lesson_slug: "book-1-l02-seeing-stopping-and-taking",
          line: 305,
          source_path: "body.blocks[70].children[0]"
        }),
        expect.objectContaining({
          field: "lesson.body",
          lesson_slug: "book-1-l03-bow-girl-chase-and-rescue",
          line: 209,
          source_path: "body.blocks[40].children[1]"
        })
      ])
    );
    expect(usage.usages).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lesson_slug: "book-1-l01-sword-pronouns-and-first-movement",
          line: 79
        })
      ])
    );
  });

  it("sorts and truncates usages by resolved source-file line", async () => {
    const result = await parseMediaDirectory("content/media/crystal-hunters");

    expect(result.ok).toBe(true);

    const usage = buildContentEntryUsage({
      bundles: [result.data],
      entryId: "grammar-ch-ad-hoc-ari-nashi-labels",
      mediaSlug: "crystal-hunters",
      repositoryRoot: process.cwd(),
      usageLimit: 5
    });

    expect("error" in usage).toBe(false);

    if ("error" in usage) {
      return;
    }

    expect(usage.usages.map((item) => item.line)).toEqual([24, 34, 40, 51, 67]);
  });

  it("keeps verified structured card field lines before occurrence fallback", async () => {
    const result = await parseMediaDirectory("content/media/duel-masters-dm25");

    expect(result.ok).toBe(true);

    const usage = buildContentEntryUsage({
      bundles: [result.data],
      entryId: "grammar-shoukan-ni-yotte",
      mediaSlug: "duel-masters-dm25",
      repositoryRoot: process.cwd(),
      usageLimit: 20
    });

    expect("error" in usage).toBe(false);

    if ("error" in usage) {
      return;
    }

    expect(usage.usages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "card.front",
          line: 140,
          source_path: "body.blocks[7].front.nodes[1]"
        }),
        expect.objectContaining({
          field: "card.example_jp",
          line: 143,
          source_path: "body.blocks[7].example_jp.nodes[1]"
        })
      ])
    );
  });

  it("reports grammar references from lesson prose and card notes", async () => {
    const result = await parseMediaDirectory(validMediaDirectory);

    expect(result.ok).toBe(true);

    const usage = buildContentEntryUsage({
      bundles: [result.data],
      entryId: "grammar-teiru",
      mediaSlug: "sample-anime",
      repositoryRoot: process.cwd()
    });

    expect("error" in usage).toBe(false);

    if ("error" in usage) {
      return;
    }

    expect(usage.counts).toEqual({
      cards: 1,
      lessons: 1,
      usages: 2
    });
    expect(usage.usages).toEqual([
      expect.objectContaining({
        field: "lesson.body",
        line: 17
      }),
      expect.objectContaining({
        card_id: "card-teiru-concept",
        field: "card.notes_it",
        line: 47
      })
    ]);
  });

  it("can resolve an exact surface without matching meanings or substrings", async () => {
    const result = await parseMediaDirectory(validMediaDirectory);

    expect(result.ok).toBe(true);

    const usage = buildContentEntryUsage({
      bundles: [result.data],
      kind: "grammar",
      mediaSlug: "sample-anime",
      repositoryRoot: process.cwd(),
      surface: "~ている"
    });

    expect("error" in usage).toBe(false);

    if ("error" in usage) {
      return;
    }

    expect(usage.entry.id).toBe("grammar-teiru");
    expect(() =>
      buildContentEntryUsage({
        bundles: [result.data],
        mediaSlug: "sample-anime",
        repositoryRoot: process.cwd(),
        surface: "mangiare"
      })
    ).toThrow("No exact entry match found.");
    expect(() =>
      buildContentEntryUsage({
        bundles: [result.data],
        mediaSlug: "sample-anime",
        repositoryRoot: process.cwd(),
        surface: "Forma in -te iru"
      })
    ).toThrow("No exact entry match found.");
  });

  it("reports entry-only status and usage truncation", async () => {
    const result = await parseMediaDirectory(validMediaDirectory);

    expect(result.ok).toBe(true);

    result.data.terms.push({
      ...result.data.terms[0]!,
      aliases: [],
      audio: undefined,
      id: "term-entry-only",
      lemma: "単語だけ",
      meaningIt: "solo entry",
      pitchAccent: undefined,
      reading: "たんごだけ",
      romaji: "tango dake"
    });

    const entryOnly = buildContentEntryUsage({
      bundles: [result.data],
      entryId: "term-entry-only",
      mediaSlug: "sample-anime",
      repositoryRoot: process.cwd()
    });

    expect("error" in entryOnly).toBe(false);

    if ("error" in entryOnly) {
      return;
    }

    expect(entryOnly.entry.status).toBe("entry-only");
    expect(entryOnly.counts).toEqual({
      cards: 0,
      lessons: 0,
      usages: 0
    });

    const baseReference = result.data.references.find(
      (reference) => reference.targetId === "term-taberu"
    )!;

    for (let index = 0; index < 6; index += 1) {
      result.data.references.push({
        ...baseReference,
        sourcePath: `body.blocks[99].children[${index}]`,
        location: {
          start: {
            column: 1,
            line: 100 + index
          },
          end: {
            column: 2,
            line: 100 + index
          }
        }
      });
    }

    const truncated = buildContentEntryUsage({
      bundles: [result.data],
      entryId: "term-taberu",
      mediaSlug: "sample-anime",
      repositoryRoot: process.cwd(),
      usageLimit: 3
    });

    expect("error" in truncated).toBe(false);

    if ("error" in truncated) {
      return;
    }

    expect(truncated.counts.usages).toBe(8);
    expect(truncated.usages).toHaveLength(3);
    expect(truncated.truncated.usages).toBe(true);
  });
});
