import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runNodeCli } from "./helpers/run-cli";

const compareScriptPath = path.join(
  process.cwd(),
  "scripts",
  "dm-official-text-compare.ts"
);
const fixtureDir = path.join(process.cwd(), "tests/fixtures/dm-card-fetch");
const dedodamFixture = path.join(
  fixtureDir,
  "official-detail-dm25rp4-T07.html"
);
const triggerFixture = path.join(fixtureDir, "official-detail-dmr19-067.html");
const triggerFixtureUrl =
  "https://dm.takaratomy.co.jp/card/detail/?id=dmr19-067";

describe("dm official text compare CLI", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs.length = 0;
  });

  it("compares visible card text against an official fixture without dumping full text", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        compareScriptPath,
        "--fixture-html",
        triggerFixture,
        "--fixture-url",
        triggerFixtureUrl,
        "--visible-name",
        "トリガ・トリカマ",
        "--visible-type",
        "クリーチャー",
        "--visible-keyword",
        "ブロッカー",
        "--visible-card-line",
        "このクリーチャーは攻撃できない。"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain(
      "OFFICIAL_TEXT_COMPARE supported source=official-tcg confidence=high checks=pass authority=helper"
    );
    expect(stdout).toContain("GROUND_TRUTH user-input");
    expect(stdout).toContain(
      'CHECK pass name mode=exact visible="トリガ・トリカマ"'
    );
    expect(stdout).toContain(
      'CHECK pass keyword mode=exact visible="ブロッカー" official_line=2'
    );
    expect(stdout).toContain(
      'CHECK pass card-line mode=exact visible="このクリーチャーは攻撃できない。" official_line=3'
    );
    expect(stdout).toContain("OFFICIAL_TEXT lines=3 hash=sha256:");
    expect(stdout).not.toContain("T1 ");
    expect(stdout).toContain(
      "ACTION official page did not contradict checked user-visible text"
    );
  });

  it("declares normalized matches without fuzzy-matching kanji or wording", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        compareScriptPath,
        "--fixture-html",
        triggerFixture,
        "--fixture-url",
        triggerFixtureUrl,
        "--visible-card-line",
        "Ｓ・トリガー"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain(
      'CHECK pass card-line mode=normalized visible="Ｓ・トリガー" official_line=1'
    );
  });

  it("compares multiline visible text files as user input", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-dm-compare-"));
    tempDirs.push(tempDir);
    const visibleTextPath = path.join(tempDir, "visible.txt");

    await writeFile(
      visibleTextPath,
      [
        "ブロッカー（このクリーチャーをタップして、相手クリーチャーの攻撃先をこのクリーチャーに変更してもよい）",
        "このクリーチャーは攻撃できない。"
      ].join("\n"),
      "utf8"
    );

    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        compareScriptPath,
        "--fixture-html",
        triggerFixture,
        "--fixture-url",
        triggerFixtureUrl,
        "--visible-text-file",
        visibleTextPath
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("OFFICIAL_TEXT_COMPARE supported");
    expect(stdout).toContain(
      'CHECK pass card-line mode=exact visible="ブロッカー（このクリーチャーをタップして、相手クリーチャーの攻撃先をこのクリーチャーに変更してもよい）" official_line=2'
    );
    expect(stdout).toContain(
      'CHECK pass card-line mode=exact visible="このクリーチャーは攻撃できない。" official_line=3'
    );
  });

  it("returns exit code 4 when official text contradicts visible user input", async () => {
    let failure: { code?: number; stdout?: string } | null = null;

    try {
      await runNodeCli(
        [
          "--experimental-strip-types",
          compareScriptPath,
          "--fixture-html",
          dedodamFixture,
          "--fixture-url",
          "https://dm.takaratomy.co.jp/card/detail/?id=dm25rp4-T07",
          "--visible-name",
          "貝獣 ラリア",
          "--visible-card-line",
          "次の条件を満たしていれば、"
        ],
        { timeoutMs: 60_000 }
      );
    } catch (error) {
      failure = error as { code?: number; stdout?: string };
    }

    expect(failure).not.toBeNull();
    expect(failure?.code).toBe(4);
    expect(failure?.stdout).toContain(
      "OFFICIAL_TEXT_COMPARE mismatch source=official-tcg confidence=blocked checks=fail authority=helper"
    );
    expect(failure?.stdout).toContain('CHECK fail name visible="貝獣 ラリア"');
    expect(failure?.stdout).toContain(
      'CHECK fail card-line visible="次の条件を満たしていれば、"'
    );
    expect(failure?.stdout).toContain(
      "ACTION keep user-provided screenshot/text"
    );
  });

  it("rejects compare runs without visible user input", async () => {
    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          compareScriptPath,
          "--fixture-html",
          triggerFixture,
          "--fixture-url",
          triggerFixtureUrl
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "Provide at least one visible user-input selector"
      )
    });
  });

  it("rejects unsafe sources and conflicting selectors", async () => {
    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          compareScriptPath,
          "--official-id",
          "dm25rp4-T07",
          "--fixture-html",
          dedodamFixture,
          "--visible-name",
          "天災 デドダム"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "Provide exactly one source selector: --official-id, --url, or --fixture-html."
      )
    });

    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          compareScriptPath,
          "--url",
          "https://example.com/card/detail/?id=dmr19-067",
          "--visible-name",
          "トリガ・トリカマ"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--url must point to https://dm.takaratomy.co.jp/card/detail/ with a safe id."
      )
    });
  });

  it("emits stable JSON for automation", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        compareScriptPath,
        "--fixture-html",
        triggerFixture,
        "--fixture-url",
        triggerFixtureUrl,
        "--visible-keyword",
        "ブロッカー",
        "--json"
      ],
      { timeoutMs: 60_000 }
    );
    const payload = JSON.parse(stdout) as {
      authority: string;
      checks: { items: Array<{ field: string; status: string }> };
      ground_truth: string;
      status: string;
    };

    expect(payload).toEqual(
      expect.objectContaining({
        authority: "helper",
        ground_truth: "user-input",
        status: "supported"
      })
    );
    expect(payload.checks.items).toEqual([
      expect.objectContaining({
        field: "keyword",
        status: "pass"
      })
    ]);
  });
});
