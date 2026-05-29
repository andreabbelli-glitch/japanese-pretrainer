import path from "node:path";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { NormalizedMediaBundle } from "@/features/content/types";
import {
  buildTofuguPronunciationIndex,
  findTofuguMatchForTarget,
  importTofuguPronunciationsForBundle,
  parseTofuguPronunciationFilename
} from "@/lib/tofugu-pronunciation-dataset";
import type { PronunciationTargetEntry } from "@/lib/pronunciation-shared";

describe("Tofugu pronunciation dataset", () => {
  let tempDir = "";
  let datasetDir = "";
  let mediaDirectory = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-tofugu-dataset-"));
    datasetDir = path.join(tempDir, "tofugu");
    mediaDirectory = path.join(tempDir, "content", "media", "sample-game");
    await mkdir(path.join(datasetDir, "lib", "mp3"), { recursive: true });
    await mkdir(mediaDirectory, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("parses Japanese dataset filenames with and without readings", () => {
    expect(parseTofuguPronunciationFilename("食べる【たべる】.mp3")).toEqual({
      reading: "たべる",
      surface: "食べる"
    });
    expect(parseTofuguPronunciationFilename("食べる.mp3")).toEqual({
      surface: "食べる"
    });
    expect(parseTofuguPronunciationFilename("食べる【たべる】.ogg")).toBeNull();
    expect(parseTofuguPronunciationFilename("食べる【たべる.mp3")).toBeNull();
    expect(parseTofuguPronunciationFilename("食べる】.mp3")).toBeNull();
    expect(
      parseTofuguPronunciationFilename("食【べる【たべる】.mp3")
    ).toBeNull();
    expect(
      parseTofuguPronunciationFilename("食べる【たべる】【x】.mp3")
    ).toBeNull();
  });

  it("matches terms by exact lemma plus reading before considering Forvo", async () => {
    await seedDatasetFile("食べる【たべる】.mp3");
    await seedDatasetFile("食べる.mp3");
    const index = await buildTofuguPronunciationIndex(datasetDir);

    const match = findTofuguMatchForTarget(
      createTarget({
        label: "食べる",
        reading: "たべる"
      }),
      index
    );

    expect(match).toMatchObject({
      status: "matched",
      entry: expect.objectContaining({
        reading: "たべる",
        surface: "食べる"
      })
    });
  });

  it("matches terms by exact alias plus reading", async () => {
    await seedDatasetFile("食べる【たべる】.mp3");
    const index = await buildTofuguPronunciationIndex(datasetDir);

    const match = findTofuguMatchForTarget(
      createTarget({
        aliases: ["食べる"],
        label: "喰う",
        reading: "たべる"
      }),
      index
    );

    expect(match.status).toBe("matched");
  });

  it("does not resolve a reading-bearing term from reading alone or surface-only audio", async () => {
    await seedDatasetFile("食べる.mp3");
    await seedDatasetFile("読む【よむ】.mp3");
    const index = await buildTofuguPronunciationIndex(datasetDir);

    expect(
      findTofuguMatchForTarget(
        createTarget({
          label: "食べる",
          reading: "たべる"
        }),
        index
      ).status
    ).toBe("not_found");
    expect(
      findTofuguMatchForTarget(
        createTarget({
          label: "別",
          reading: "よむ"
        }),
        index
      ).status
    ).toBe("not_found");
  });

  it("marks no-reading surface matches ambiguous when the dataset has homographs", async () => {
    await seedDatasetFile("生【せい】.mp3");
    await seedDatasetFile("生【なま】.mp3");
    const index = await buildTofuguPronunciationIndex(datasetDir);

    const match = findTofuguMatchForTarget(
      createTarget({
        label: "生"
      }),
      index
    );

    expect(match).toMatchObject({
      candidates: expect.arrayContaining([
        expect.objectContaining({ reading: "せい" }),
        expect.objectContaining({ reading: "なま" })
      ]),
      status: "ambiguous"
    });
  });

  it("matches grammar by exact cleaned Japanese pattern without splitting variants", async () => {
    await seedDatasetFile("に行く／に来る【にいくにくる】.mp3");
    await seedDatasetFile("に行く【にいく】.mp3");
    const index = await buildTofuguPronunciationIndex(datasetDir);

    expect(
      findTofuguMatchForTarget(
        createTarget({
          kind: "grammar",
          label: "{{に|に}}行く／に来る"
        }),
        index
      ).status
    ).toBe("matched");
    expect(
      findTofuguMatchForTarget(
        createTarget({
          kind: "grammar",
          label: "radice verbale + に行く／に来る"
        }),
        index
      ).status
    ).toBe("not_found");
  });

  it("requires exact readings for reading-bearing grammar targets", async () => {
    await seedDatasetFile("上.mp3");
    await seedDatasetFile("上【じょう】.mp3");
    await seedDatasetFile("上【うえ】.mp3");
    const index = await buildTofuguPronunciationIndex(datasetDir);

    const match = findTofuguMatchForTarget(
      createTarget({
        kind: "grammar",
        label: "上",
        reading: "うえ"
      }),
      index
    );

    expect(match).toMatchObject({
      status: "matched",
      entry: expect.objectContaining({
        reading: "うえ",
        surface: "上"
      })
    });
  });

  it("does not delete grammar wave markers during exact matching", async () => {
    await seedDatasetFile("〜丁目.mp3");
    const index = await buildTofuguPronunciationIndex(datasetDir);

    expect(
      findTofuguMatchForTarget(
        createTarget({
          kind: "grammar",
          label: "丁目"
        }),
        index
      ).status
    ).toBe("not_found");
    expect(
      findTofuguMatchForTarget(
        createTarget({
          kind: "grammar",
          label: "～丁目"
        }),
        index
      ).status
    ).toBe("matched");
  });

  it("imports matched MP3 files into the media bundle manifest", async () => {
    await seedDatasetFile("食べる【たべる】.mp3", "audio");
    await writeFile(
      path.join(mediaDirectory, "pronunciations.json"),
      `${JSON.stringify(
        {
          version: 1,
          entries: [
            {
              entry_type: "term",
              entry_id: "term-eat",
              pitch_accent: 2,
              pitch_accent_source: "Wiktionary",
              pitch_accent_status: "resolved"
            }
          ]
        },
        null,
        2
      )}\n`
    );

    const summary = await importTofuguPronunciationsForBundle({
      bundle: createBundle(),
      datasetDir,
      dryRun: false,
      onlyTargets: [
        createTarget({
          id: "term-eat",
          label: "食べる",
          reading: "たべる"
        })
      ]
    });

    expect(summary).toMatchObject({
      ambiguous: 0,
      matched: 1,
      notFound: 0
    });

    await expect(
      stat(
        path.join(
          mediaDirectory,
          "assets",
          "audio",
          "term",
          "term-eat",
          "tofugu-wanikani-食べる.mp3"
        )
      )
    ).resolves.toBeDefined();

    const manifest = JSON.parse(
      await readFile(path.join(mediaDirectory, "pronunciations.json"), "utf8")
    );

    expect(manifest.entries).toEqual([
      {
        entry_type: "term",
        entry_id: "term-eat",
        audio_src:
          "assets/audio/term/term-eat/tofugu-wanikani-食べる.mp3",
        audio_source: "tofugu_wanikani",
        audio_license: "CC-BY-SA-4.0",
        audio_attribution: "Tofugu and WaniKani",
        audio_page_url:
          "https://github.com/tofugu/japanese-vocabulary-pronunciation-audio/blob/master/lib/mp3/%E9%A3%9F%E3%81%B9%E3%82%8B%E3%80%90%E3%81%9F%E3%81%B9%E3%82%8B%E3%80%91.mp3",
        pitch_accent: 2,
        pitch_accent_source: "Wiktionary",
        pitch_accent_status: "resolved"
      }
    ]);
  });

  it("reports dry-run matches without writing copied assets or manifest changes", async () => {
    await seedDatasetFile("食べる【たべる】.mp3", "audio");

    const summary = await importTofuguPronunciationsForBundle({
      bundle: createBundle(),
      datasetDir,
      dryRun: true,
      onlyTargets: [
        createTarget({
          id: "term-eat",
          label: "食べる",
          reading: "たべる"
        })
      ]
    });

    expect(summary.matched).toBe(1);
    await expect(
      stat(
        path.join(
          mediaDirectory,
          "assets",
          "audio",
          "term",
          "term-eat",
          "tofugu-wanikani-食べる.mp3"
        )
      )
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      stat(path.join(mediaDirectory, "pronunciations.json"))
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  async function seedDatasetFile(fileName: string, content = "") {
    await writeFile(path.join(datasetDir, "lib", "mp3", fileName), content);
  }

  function createBundle() {
    return {
      mediaDirectory,
      mediaSlug: "sample-game"
    } as NormalizedMediaBundle;
  }

  function createTarget(
    overrides: Partial<PronunciationTargetEntry> & {
      label: string;
    }
  ): PronunciationTargetEntry {
    return {
      aliases: overrides.aliases ?? [],
      id: overrides.id ?? "term-sample",
      kind: overrides.kind ?? "term",
      label: overrides.label,
      mediaDirectory,
      mediaSlug: "sample-game",
      reading: overrides.reading
    };
  }
});
