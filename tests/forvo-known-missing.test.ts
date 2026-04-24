import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addForvoKnownMissingEntry,
  hasForvoKnownMissingEntry,
  loadForvoKnownMissingRegistry,
  persistForvoKnownMissingRegistry,
  pruneForvoKnownMissingRegistry,
  type ForvoKnownMissingRegistry
} from "@/lib/forvo-known-missing";
import type { PronunciationTargetEntry } from "@/lib/pronunciation-shared";

describe("forvo known-missing registry", () => {
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "jcs-forvo-known-missing-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("loads a missing registry file as an empty registry", async () => {
    await expect(
      loadForvoKnownMissingRegistry(path.join(tempDir, "missing.json"))
    ).resolves.toEqual({
      entries: [],
      version: 1
    });
  });

  it("filters malformed registry entries while preserving valid entries", async () => {
    const registryPath = path.join(tempDir, "forvo-known-missing.json");

    await writeFile(
      registryPath,
      `${JSON.stringify(
        {
          version: 1,
          entries: [
            {
              entryId: "term-kiku",
              entryKind: "term",
              label: "聞く",
              mediaSlug: "sample-game",
              reading: "きく",
              reason: "not_found_on_forvo",
              updatedAt: "2026-04-24T10:00:00.000Z"
            },
            {
              entryId: "term-bad-kind",
              entryKind: "kanji",
              mediaSlug: "sample-game"
            },
            {
              entryId: "term-missing-media",
              entryKind: "term"
            },
            null,
            {
              entryId: "grammar-teiru",
              entryKind: "grammar",
              mediaSlug: "sample-anime"
            }
          ]
        },
        null,
        2
      )}\n`
    );

    await expect(loadForvoKnownMissingRegistry(registryPath)).resolves.toEqual({
      entries: [
        {
          entryId: "term-kiku",
          entryKind: "term",
          label: "聞く",
          mediaSlug: "sample-game",
          reading: "きく",
          reason: "not_found_on_forvo",
          updatedAt: "2026-04-24T10:00:00.000Z"
        },
        {
          entryId: "grammar-teiru",
          entryKind: "grammar",
          mediaSlug: "sample-anime"
        }
      ],
      version: 1
    });
  });

  it("persists registry entries sorted by media, kind, and entry id", async () => {
    const registryPath = path.join(
      tempDir,
      "nested",
      "forvo-known-missing.json"
    );
    const registry: ForvoKnownMissingRegistry = {
      entries: [
        {
          entryId: "term-b",
          entryKind: "term",
          mediaSlug: "sample-z"
        },
        {
          entryId: "term-c",
          entryKind: "term",
          mediaSlug: "sample-a"
        },
        {
          entryId: "grammar-b",
          entryKind: "grammar",
          mediaSlug: "sample-a"
        },
        {
          entryId: "term-a",
          entryKind: "term",
          mediaSlug: "sample-a"
        }
      ],
      version: 1
    };

    await persistForvoKnownMissingRegistry(registryPath, registry);

    const persisted = JSON.parse(await readFile(registryPath, "utf8")) as {
      entries: Array<{ entryId: string; entryKind: string; mediaSlug: string }>;
      version: number;
    };

    expect(persisted).toMatchObject({
      version: 1,
      entries: [
        {
          entryId: "grammar-b",
          entryKind: "grammar",
          mediaSlug: "sample-a"
        },
        {
          entryId: "term-a",
          entryKind: "term",
          mediaSlug: "sample-a"
        },
        {
          entryId: "term-c",
          entryKind: "term",
          mediaSlug: "sample-a"
        },
        {
          entryId: "term-b",
          entryKind: "term",
          mediaSlug: "sample-z"
        }
      ]
    });
  });

  it("adds known-missing entries once per media, kind, and entry id", () => {
    const registry: ForvoKnownMissingRegistry = {
      entries: [],
      version: 1
    };
    const target = buildTarget({
      id: "term-kiku",
      label: "聞く",
      reading: "きく"
    });

    expect(addForvoKnownMissingEntry(registry, { entry: target })).toBe(true);
    expect(addForvoKnownMissingEntry(registry, { entry: target })).toBe(false);
    expect(registry.entries).toHaveLength(1);
    expect(registry.entries[0]).toMatchObject({
      entryId: "term-kiku",
      entryKind: "term",
      label: "聞く",
      mediaSlug: "sample-game",
      reading: "きく",
      reason: "not_found_on_forvo"
    });
    expect(registry.entries[0]?.updatedAt).toEqual(expect.any(String));
    expect(hasForvoKnownMissingEntry(registry, target)).toBe(true);
  });

  it("does not add targets that already have audio", () => {
    const registry: ForvoKnownMissingRegistry = {
      entries: [],
      version: 1
    };
    const target = buildTarget({
      audioSrc: "assets/audio/term/term-kiku/forvo.mp3",
      id: "term-kiku",
      label: "聞く"
    });

    expect(addForvoKnownMissingEntry(registry, { entry: target })).toBe(false);
    expect(registry.entries).toEqual([]);
  });

  it("prunes audio-backed entries only for the active media", () => {
    const registry: ForvoKnownMissingRegistry = {
      entries: [
        {
          entryId: "term-kiku",
          entryKind: "term",
          mediaSlug: "sample-game"
        },
        {
          entryId: "term-yomu",
          entryKind: "term",
          mediaSlug: "sample-game"
        },
        {
          entryId: "term-kiku",
          entryKind: "term",
          mediaSlug: "other-media"
        }
      ],
      version: 1
    };

    expect(
      pruneForvoKnownMissingRegistry(
        registry,
        [
          buildTarget({
            audioSrc: "assets/audio/term/term-kiku/forvo.mp3",
            id: "term-kiku",
            label: "聞く"
          }),
          buildTarget({
            audioSrc: "assets/audio/term/term-kiku/forvo.mp3",
            id: "term-kiku",
            label: "聞く",
            mediaSlug: "other-media"
          }),
          buildTarget({
            id: "term-yomu",
            label: "読む"
          })
        ],
        "sample-game"
      )
    ).toBe(true);

    expect(registry.entries).toEqual([
      {
        entryId: "term-yomu",
        entryKind: "term",
        mediaSlug: "sample-game"
      },
      {
        entryId: "term-kiku",
        entryKind: "term",
        mediaSlug: "other-media"
      }
    ]);
  });
});

function buildTarget(
  input: Partial<PronunciationTargetEntry> & {
    id: string;
    label: string;
  }
): PronunciationTargetEntry {
  const mediaSlug = input.mediaSlug ?? "sample-game";

  return {
    aliases: input.aliases ?? [],
    audioSrc: input.audioSrc,
    crossMediaGroup: input.crossMediaGroup,
    id: input.id,
    kind: input.kind ?? "term",
    label: input.label,
    mediaDirectory: input.mediaDirectory ?? path.join("/tmp", mediaSlug),
    mediaSlug,
    reading: input.reading
  };
}
