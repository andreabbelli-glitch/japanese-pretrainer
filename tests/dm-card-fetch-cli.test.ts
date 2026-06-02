import path from "node:path";

import { describe, expect, it } from "vitest";

import { runNodeCli } from "./helpers/run-cli";

const cardFetchScriptPath = path.join(
  process.cwd(),
  "scripts",
  "dm-card-fetch.ts"
);
const fixturePath = path.join(
  process.cwd(),
  "tests/fixtures/dm-card-fetch/official-detail-dm25rp4-T07.html"
);
const fixtureUrl = "https://dm.takaratomy.co.jp/card/detail/?id=dm25rp4-T07";

describe("dm card fetch CLI", () => {
  it("prints official detail data from a fixture without network access", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        cardFetchScriptPath,
        "--fixture-html",
        fixturePath,
        "--fixture-url",
        fixtureUrl,
        "--expect-name",
        "天災 デドダム",
        "--expect-keyword",
        "出た時"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain(
      "STATUS found source=official-tcg confidence=high checks=pass"
    );
    expect(stdout).toContain('CHECK pass name expected="天災 デドダム"');
    expect(stdout).toContain('CHECK pass keyword expected="出た時"');
    expect(stdout).toContain(
      "URL https://dm.takaratomy.co.jp/card/detail/?id=dm25rp4-T07"
    );
  });

  it("emits JSON for downstream scaffolding tools", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        cardFetchScriptPath,
        "--fixture-html",
        fixturePath,
        "--fixture-url",
        fixtureUrl,
        "--json"
      ],
      { timeoutMs: 60_000 }
    );
    const payload = JSON.parse(stdout) as {
      card: { name: string; officialId: string };
      flags: string[];
      status: string;
    };

    expect(payload.status).toBe("found");
    expect(payload.card).toEqual(
      expect.objectContaining({
        name: "天災 デドダム",
        officialId: "dm25rp4-T07"
      })
    );
    expect(payload.flags).toContain("ground_truth_user_input");
  });

  it("returns exit code 4 when fetched official data conflicts with expectations", async () => {
    let failure: { code?: number; stdout?: string } | null = null;

    try {
      await runNodeCli(
        [
          "--experimental-strip-types",
          cardFetchScriptPath,
          "--fixture-html",
          fixturePath,
          "--fixture-url",
          fixtureUrl,
          "--expect-name",
          "貝獣 ラリア"
        ],
        { timeoutMs: 60_000 }
      );
    } catch (error) {
      failure = error as { code?: number; stdout?: string };
    }

    expect(failure).not.toBeNull();
    expect(failure?.code).toBe(4);
    expect(failure?.stdout).toContain("STATUS mismatch");
    expect(failure?.stdout).toContain('CHECK fail name expected="貝獣 ラリア"');
  });

  it("rejects conflicting selectors and non-official fixture URLs", async () => {
    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          cardFetchScriptPath,
          "--official-id",
          "dm25rp4-T07",
          "--fixture-html",
          fixturePath
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
          cardFetchScriptPath,
          "--fixture-html",
          fixturePath,
          "--fixture-url",
          "https://example.com/card/detail/?id=dm25rp4-T07"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--fixture-url must point to https://dm.takaratomy.co.jp/card/detail/ with a safe id."
      )
    });

    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          cardFetchScriptPath,
          "--url",
          "http://dm.takaratomy.co.jp/card/detail/?id=dm25rp4-T07"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--url must point to https://dm.takaratomy.co.jp/card/detail/ with a safe id."
      )
    });

    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          cardFetchScriptPath,
          "--url",
          "https://dm.takaratomy.co.jp/card/detail/?id=dm25rp4-T07&id=../bad"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--url must point to https://dm.takaratomy.co.jp/card/detail/ with a safe id."
      )
    });
  });
});
