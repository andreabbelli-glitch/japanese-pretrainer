import path from "node:path";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseContentRoot } from "@/lib/content/validator";
import { writeBundlePronunciationPendingSummary } from "@/lib/pronunciation-workflow";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesRoot = path.resolve(__dirname, "fixtures", "content");
const validContentRoot = path.join(fixturesRoot, "valid", "content");

describe("pronunciation workflow", () => {
  let tempDir = "";
  let contentRoot = "";
  let mediaDirectory = "";
  let knownMissingPath = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-pronunciation-workflow-"));
    contentRoot = path.join(tempDir, "content");
    mediaDirectory = path.join(contentRoot, "media", "frieren");
    knownMissingPath = path.join(tempDir, "data", "forvo-known-missing.json");

    await cp(validContentRoot, contentRoot, { recursive: true });
    await mkdir(path.dirname(knownMissingPath), { recursive: true });
    await writeFile(
      path.join(mediaDirectory, "cards", "002-extra.md"),
      `---
id: cards-frieren-extra
media_id: media-frieren
slug: ep01-extra
title: Episodio 1 - Extra cards
order: 20
segment_ref: episode-01
---

:::term
id: term-miru
lemma: 見る
reading: みる
romaji: miru
meaning_it: vedere
aliases: [みる, miru]
:::

:::term
id: term-kiku
lemma: 聞く
reading: きく
romaji: kiku
meaning_it: ascoltare
aliases: [きく, kiku]
:::

:::card
id: card-miru-recognition
entry_type: term
entry_id: term-miru
card_type: recognition
front: 見る
back: vedere
tags: [verb, extra]
:::
`
    );
    await writeFile(
      knownMissingPath,
      `${JSON.stringify(
        {
          version: 1,
          entries: [
            {
              entryId: "term-kiku",
              entryKind: "term",
              label: "聞く",
              mediaSlug: "frieren",
              reading: "きく",
              reason: "not_found_on_forvo",
              updatedAt: "2026-03-12T18:30:00.000Z"
            }
          ]
        },
        null,
        2
      )}\n`
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes only entries still pending after audio and known-missing filters", async () => {
    const parseResult = await parseContentRoot(contentRoot);

    expect(parseResult.ok).toBe(true);

    const bundle = parseResult.ok
      ? parseResult.data.bundles.find((candidate) => candidate.mediaSlug === "frieren")
      : undefined;

    expect(bundle).toBeDefined();

    const summary = await writeBundlePronunciationPendingSummary({
      bundle: bundle!,
      knownMissingPath
    });

    expect(summary.totalTargets).toBe(4);
    expect(summary.audioBackedCount).toBe(2);
    expect(summary.knownMissingCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
    expect(summary.pending).toEqual([
      {
        entryId: "term-miru",
        entryType: "term",
        label: "見る",
        reading: "みる"
      }
    ]);

    const pendingSource = await readFile(summary.workflowFilePath, "utf8");
    const pending = JSON.parse(pendingSource);

    expect(pending).toEqual({
      version: 1,
      media_slug: "frieren",
      total_targets: 4,
      audio_backed_count: 2,
      known_missing_count: 1,
      pending_count: 1,
      pending: [
        {
          entry_type: "term",
          entry_id: "term-miru",
          label: "見る",
          reading: "みる"
        }
      ]
    });
  });
});
