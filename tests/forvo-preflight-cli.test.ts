import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildForvoPreflight,
  formatForvoPreflightReport
} from "@/features/pronunciation/tooling/forvo-preflight";
import { buildForvoWordAddUrl } from "@/features/pronunciation/tooling/forvo-word-add";

import { validContentRoot } from "./helpers/content-fixtures";
import { runNodeCli } from "./helpers/run-cli";

const forvoPreflightScriptPath = path.join(
  process.cwd(),
  "scripts",
  "forvo-preflight.ts"
);

describe("forvo preflight CLI", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs.length = 0;
  });

  it("summarizes audio, known-missing, and current word-add state without running the resolver", async () => {
    const tempContentRoot = await copyValidContentFixture(tempDirs);
    await removeSampleAnimeTermAudio(tempContentRoot);

    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-forvo-preflight-"));
    tempDirs.push(tempDir);
    const knownMissingPath = path.join(tempDir, "forvo-known-missing.json");
    const requestRegistryPath = path.join(
      tempDir,
      "forvo-requested-word-add.json"
    );
    const requestUrl = buildForvoWordAddUrl({
      entryId: "term-taberu",
      entryKind: "term",
      label: "食べる",
      reading: "たべる"
    });

    expect(requestUrl).not.toBeNull();

    await writeFile(
      knownMissingPath,
      `${JSON.stringify(
        {
          entries: [
            {
              entryId: "term-taberu",
              entryKind: "term",
              label: "食べる",
              mediaSlug: "sample-anime",
              reading: "たべる",
              reason: "not_found_on_forvo",
              updatedAt: "2026-04-18T09:00:00.000Z"
            }
          ],
          version: 1
        },
        null,
        2
      )}\n`
    );
    await writeFile(
      requestRegistryPath,
      `${JSON.stringify(
        {
          entries: [
            {
              entryId: "term-taberu",
              entryKind: "term",
              label: "食べる",
              mediaSlug: "sample-anime",
              reading: "たべる",
              requestUrl,
              requestedAt: "2026-04-18T09:05:00.000Z"
            }
          ],
          version: 1
        },
        null,
        2
      )}\n`
    );

    const report = await buildForvoPreflight({
      contentRoot: tempContentRoot,
      entryIds: ["term-taberu", "grammar-teiru"],
      knownMissingPath,
      mediaSlug: "sample-anime",
      mode: "targeted",
      requestRegistryPath
    });

    expect(report.status).toBe("waiting");
    expect(report.totals).toMatchObject({
      audioBacked: 1,
      blocked: 0,
      knownMissing: 1,
      requestedCurrent: 1,
      runnable: 0,
      selected: 2,
      withoutAudio: 1
    });
    expect(report.bundles[0]?.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entryId: "term-taberu",
          status: "known-missing-requested"
        }),
        expect.objectContaining({
          entryId: "grammar-teiru",
          status: "audio-ready"
        })
      ])
    );
    expect(formatForvoPreflightReport(report)).toContain(
      "FORVO_PREFLIGHT waiting mode=targeted media=sample-anime selected=2 runnable=0 audio=1 known_missing=1 requested=1 blocked=0"
    );
  });

  it("matches resolver retry semantics for blocked known-missing entries", async () => {
    const tempContentRoot = await copyValidContentFixture(tempDirs);
    await removeSampleAnimeTermAudio(tempContentRoot);

    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-forvo-preflight-"));
    tempDirs.push(tempDir);
    const knownMissingPath = path.join(tempDir, "forvo-known-missing.json");
    const requestRegistryPath = path.join(
      tempDir,
      "forvo-requested-word-add.json"
    );

    await writeFile(
      knownMissingPath,
      `${JSON.stringify(
        {
          entries: [
            {
              entryId: "term-taberu",
              entryKind: "term",
              label: "食べる",
              mediaSlug: "sample-anime",
              reading: "たべる",
              reason: "not_found_on_forvo",
              updatedAt: "2026-04-18T09:00:00.000Z",
              wordAddBlockedReason: "forvo_rejected"
            }
          ],
          version: 1
        },
        null,
        2
      )}\n`
    );
    await writeFile(requestRegistryPath, `{"version":1,"entries":[]}\n`);

    const report = await buildForvoPreflight({
      contentRoot: tempContentRoot,
      entryIds: ["term-taberu"],
      knownMissingPath,
      mediaSlug: "sample-anime",
      mode: "targeted",
      requestRegistryPath,
      retryKnownMissing: true
    });

    expect(report.status).toBe("ready");
    expect(report.totals).toMatchObject({
      blocked: 0,
      knownMissing: 1,
      runnable: 1,
      selected: 1,
      withoutAudio: 1
    });
    expect(report.bundles[0]?.targets).toEqual([
      expect.objectContaining({
        blockedReason: "forvo_rejected",
        entryId: "term-taberu",
        status: "retry-known-missing"
      })
    ]);
  });

  it("prints the canonical resolver command for runnable targets", async () => {
    const tempContentRoot = await copyValidContentFixture(tempDirs);
    await removeSampleAnimeTermAudio(tempContentRoot);
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-forvo-preflight-"));
    tempDirs.push(tempDir);
    const knownMissingPath = path.join(tempDir, "forvo-known-missing.json");
    const requestRegistryPath = path.join(
      tempDir,
      "forvo-requested-word-add.json"
    );

    await writeFile(knownMissingPath, `{"version":1,"entries":[]}\n`);
    await writeFile(requestRegistryPath, `{"version":1,"entries":[]}\n`);

    const { stdout } = await runNodeCli(
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--experimental-strip-types",
        forvoPreflightScriptPath,
        "--content-root",
        tempContentRoot,
        "--known-missing-file",
        knownMissingPath,
        "--request-registry-file",
        requestRegistryPath,
        "--mode",
        "targeted",
        "--media",
        "sample-anime",
        "--entry",
        "term-taberu"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain(
      "FORVO_PREFLIGHT ready mode=targeted media=sample-anime selected=1 runnable=1 audio=0 known_missing=0 requested=0 blocked=0"
    );
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm pronunciations:resolve -- --content-root"
    );
    expect(stdout).toContain("--mode targeted --media sample-anime");
    expect(stdout).toContain(
      "TARGET sample-anime:term:term-taberu needs-resolution"
    );
    expect(stdout).not.toContain("--dry-run");
  });

  it("rejects missing selector option values before inspecting content", async () => {
    await expect(
      runNodeCli(
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          forvoPreflightScriptPath,
          "--mode",
          "targeted",
          "--media",
          "--entry",
          "term-taberu"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Missing value for --media.")
    });
  });
});

async function copyValidContentFixture(tempDirs: string[]) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-content-fixture-"));
  const tempContentRoot = path.join(tempDir, "content");

  tempDirs.push(tempDir);
  await cp(validContentRoot, tempContentRoot, { recursive: true });

  return tempContentRoot;
}

async function removeSampleAnimeTermAudio(contentRoot: string) {
  const cardsPath = path.join(
    contentRoot,
    "media",
    "sample-anime",
    "cards",
    "001-core.md"
  );
  const source = await readFile(cardsPath, "utf8");

  await writeFile(
    cardsPath,
    source.replace(
      /\naudio_src: .+\naudio_source: .+\naudio_speaker: .+\naudio_license: .+\naudio_attribution: .+\naudio_page_url: .+\n/u,
      "\n"
    )
  );
}
