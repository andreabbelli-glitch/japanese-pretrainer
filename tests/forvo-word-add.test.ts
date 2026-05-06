import { execFile } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  addForvoWordAddRequestEntry,
  buildForvoWordAddPrefill,
  buildForvoWordAddUrl,
  hasForvoWordAddRequestForEntry,
  loadForvoWordAddRequestRegistry,
  normalizeForvoWordAddLabel,
  persistForvoWordAddRequestRegistry,
  reconcileForvoWordAddRequestRegistry,
  type ForvoWordAddRequestRegistry
} from "@/lib/pronunciation";

const execFileAsync = promisify(execFile);

describe("forvo word-add helpers", () => {
  it("builds the expected word-add URL for a label", () => {
    expect(
      buildForvoWordAddUrl({
        entryId: "term-kougekisaki",
        entryKind: "term",
        label: "攻撃先",
        reading: "こうげきさき"
      })
    ).toBe(
      "https://forvo.com/word-add/%E6%94%BB%E6%92%83%E5%85%88/?jcs_lang=ja&jcs_phrase=0&jcs_autosubmit=1&jcs_person_name=0"
    );
  });

  it("normalizes slash-separated labels for Forvo word-add URLs", () => {
    expect(normalizeForvoWordAddLabel("持ちきれない / 持ちきれません")).toBe(
      "持ちきれない・持ちきれません"
    );

    expect(
      buildForvoWordAddUrl({
        entryId: "term-e003-mochikirenai-mochikiremasen",
        entryKind: "term",
        label: "持ちきれない / 持ちきれません",
        reading: "もちきれない / もちきれません"
      })
    ).toBe(
      "https://forvo.com/word-add/%E6%8C%81%E3%81%A1%E3%81%8D%E3%82%8C%E3%81%AA%E3%81%84%E3%83%BB%E6%8C%81%E3%81%A1%E3%81%8D%E3%82%8C%E3%81%BE%E3%81%9B%E3%82%93/?jcs_lang=ja&jcs_phrase=1&jcs_autosubmit=1&jcs_person_name=0"
    );
  });

  it("marks phrase-like entries with a phrase prefill", () => {
    expect(
      buildForvoWordAddPrefill({
        entryId: "grammar-g034-perche",
        entryKind: "grammar",
        label: "から"
      })
    ).toMatchObject({
      autoSubmit: true,
      isPhrase: true,
      isPersonalName: false,
      languageCode: "ja"
    });

    expect(
      buildForvoWordAddPrefill({
        entryId: "term-e025-dekiruyouninatta",
        entryKind: "term",
        label: "〜できるようになった",
        reading: "〜できるようになった"
      }).isPhrase
    ).toBe(true);

    expect(
      buildForvoWordAddPrefill({
        entryId: "term-e101-shitei-no-kyoushitsu-e-mukatte-kudasai",
        entryKind: "term",
        label: "指定の教室へ 向かってください",
        reading: "していの きょうしつへ むかってください"
      }).isPhrase
    ).toBe(true);

    expect(
      buildForvoWordAddPrefill({
        entryId: "term-kougekisaki",
        entryKind: "term",
        label: "攻撃先",
        reading: "こうげきさき"
      }).isPhrase
    ).toBe(false);
  });

  it("deduplicates requested word-add entries by media, kind, and id", () => {
    const registry: ForvoWordAddRequestRegistry = {
      entries: [],
      version: 1
    };

    expect(
      addForvoWordAddRequestEntry(registry, {
        entryId: "term-kougekisaki",
        entryKind: "term",
        label: "攻撃先",
        mediaSlug: "duel-masters-dm25",
        reading: "こうげきさき"
      })
    ).toBe(true);
    expect(
      addForvoWordAddRequestEntry(registry, {
        entryId: "term-kougekisaki",
        entryKind: "term",
        label: "攻撃先",
        mediaSlug: "duel-masters-dm25",
        reading: "こうげきさき"
      })
    ).toBe(false);

    expect(registry.entries).toHaveLength(1);
    expect(
      hasForvoWordAddRequestForEntry(registry, {
        entryId: "term-kougekisaki",
        entryKind: "term",
        mediaSlug: "duel-masters-dm25"
      })
    ).toBe(true);
    expect(registry.entries[0]?.requestUrl).toBe(
      "https://forvo.com/word-add/%E6%94%BB%E6%92%83%E5%85%88/?jcs_lang=ja&jcs_phrase=0&jcs_autosubmit=1&jcs_person_name=0"
    );
  });

  it("persists requested word-add entries sorted without mutating the registry", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "jcs-forvo-word-add-"));
    const registryPath = path.join(tempDir, "forvo-requested-word-add.json");
    const registry: ForvoWordAddRequestRegistry = {
      entries: [
        {
          entryId: "term-b",
          entryKind: "term",
          label: "B",
          mediaSlug: "sample-z",
          requestUrl: "https://forvo.com/word-add/b/",
          requestedAt: "2026-04-11T22:12:00.000Z"
        },
        {
          entryId: "grammar-a",
          entryKind: "grammar",
          label: "A",
          mediaSlug: "sample-a",
          requestUrl: "https://forvo.com/word-add/a/",
          requestedAt: "2026-04-11T22:13:00.000Z"
        }
      ],
      version: 1
    };
    const originalEntryOrder = registry.entries.map((entry) => entry.entryId);

    try {
      await persistForvoWordAddRequestRegistry(registryPath, registry);

      const persisted = JSON.parse(await readFile(registryPath, "utf8")) as {
        entries: Array<{ entryId: string }>;
      };

      expect(persisted.entries.map((entry) => entry.entryId)).toEqual([
        "grammar-a",
        "term-b"
      ]);
      expect(registry.entries.map((entry) => entry.entryId)).toEqual(
        originalEntryOrder
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("marks requested entries as resolved when audio becomes available", () => {
    const registry: ForvoWordAddRequestRegistry = {
      entries: [],
      version: 1
    };

    addForvoWordAddRequestEntry(registry, {
      entryId: "term-kougekisaki",
      entryKind: "term",
      label: "攻撃先",
      mediaSlug: "duel-masters-dm25",
      reading: "こうげきさき"
    });

    const changed = reconcileForvoWordAddRequestRegistry(registry, [
      {
        audioSource: "forvo",
        audioSrc: "assets/audio/term/term-kougekisaki/forvo-speaker.mp3",
        entryId: "term-kougekisaki",
        entryKind: "term",
        mediaSlug: "duel-masters-dm25"
      }
    ]);

    expect(changed).toBe(1);
    expect(registry.entries[0]).toMatchObject({
      entryId: "term-kougekisaki",
      resolvedAudioSource: "forvo",
      resolvedAudioSrc:
        "assets/audio/term/term-kougekisaki/forvo-speaker.mp3"
    });
    expect(registry.entries[0]?.resolvedAt).toEqual(expect.any(String));
  });

  it("filters malformed registry entries while preserving valid requests", async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "jcs-forvo-word-add-")
    );
    const registryPath = path.join(tempDir, "forvo-requested-word-add.json");

    try {
      await writeFile(
        registryPath,
        `${JSON.stringify(
          {
            version: 1,
            entries: [
              {
                entryId: "term-kougekisaki",
                entryKind: "term",
                label: "攻撃先",
                mediaSlug: "duel-masters-dm25",
                requestUrl:
                  "https://forvo.com/word-add/%E6%94%BB%E6%92%83%E5%85%88/?jcs_lang=ja&jcs_phrase=0&jcs_autosubmit=1&jcs_person_name=0",
                requestedAt: "2026-04-11T22:12:00.000Z"
              },
              {
                entryId: "term-bad-kind",
                entryKind: "kanji",
                mediaSlug: "duel-masters-dm25"
              },
              {
                entryId: "term-missing-media",
                entryKind: "term"
              },
              null
            ]
          },
          null,
          2
        )}\n`
      );

      const registry = await loadForvoWordAddRequestRegistry(registryPath);

      expect(registry.entries).toEqual([
        {
          entryId: "term-kougekisaki",
          entryKind: "term",
          label: "攻撃先",
          mediaSlug: "duel-masters-dm25",
          reading: undefined,
          requestUrl:
            "https://forvo.com/word-add/%E6%94%BB%E6%92%83%E5%85%88/?jcs_lang=ja&jcs_phrase=0&jcs_autosubmit=1&jcs_person_name=0",
          requestedAt: "2026-04-11T22:12:00.000Z",
          resolvedAt: undefined,
          resolvedAudioSource: undefined,
          resolvedAudioSrc: undefined
        }
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("loads legacy registries without resolved metadata", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "jcs-forvo-word-add-"));
    const registryPath = path.join(tempDir, "forvo-requested-word-add.json");

    await writeFile(
      registryPath,
      `${JSON.stringify(
        {
          version: 1,
          entries: [
            {
              entryId: "term-kougekisaki",
              entryKind: "term",
              label: "攻撃先",
              mediaSlug: "duel-masters-dm25",
              requestUrl:
                "https://forvo.com/word-add/%E6%94%BB%E6%92%83%E5%85%88/?jcs_lang=ja&jcs_phrase=0&jcs_autosubmit=1&jcs_person_name=0",
              requestedAt: "2026-04-11T22:12:00.000Z"
            }
          ]
        },
        null,
        2
      )}\n`
    );

    const registry = await loadForvoWordAddRequestRegistry(registryPath);

    expect(registry.entries[0]).toMatchObject({
      entryId: "term-kougekisaki",
      requestUrl:
        "https://forvo.com/word-add/%E6%94%BB%E6%92%83%E5%85%88/?jcs_lang=ja&jcs_phrase=0&jcs_autosubmit=1&jcs_person_name=0"
    });
    expect(registry.entries[0]?.resolvedAt).toBeUndefined();
  });

  it("does not mark word-add requests when the browser open fails", async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "jcs-forvo-word-add-")
    );
    const fakeBinDir = path.join(tempDir, "bin");
    const knownMissingPath = path.join(tempDir, "forvo-known-missing.json");
    const requestRegistryPath = path.join(
      tempDir,
      "forvo-requested-word-add.json"
    );

    try {
      await mkdir(fakeBinDir, { recursive: true });
      await writeFile(
        path.join(fakeBinDir, "open"),
        ["#!/usr/bin/env bash", "exit 42"].join("\n")
      );
      await chmod(path.join(fakeBinDir, "open"), 0o755);
      await writeFile(
        knownMissingPath,
        `${JSON.stringify({
          version: 1,
          entries: [
            {
              entryId: "term-kiku",
              entryKind: "term",
              label: "聞く",
              mediaSlug: "sample-game",
              reading: "きく"
            }
          ]
        })}\n`
      );

      await expect(
        execFileAsync(
          process.execPath,
          [
            "--experimental-strip-types",
            path.join(process.cwd(), "scripts", "request-forvo-word-add.ts"),
            "--known-missing-file",
            knownMissingPath,
            "--request-registry-file",
            requestRegistryPath,
            "--media",
            "sample-game"
          ],
          {
            cwd: process.cwd(),
            env: {
              ...process.env,
              PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`
            }
          }
        )
      ).rejects.toMatchObject({
        stderr: expect.stringContaining("Failed to open browser URL")
      });

      await expect(readFile(requestRegistryPath, "utf8")).rejects.toMatchObject(
        {
          code: "ENOENT"
        }
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
