import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildAgentVerifyPlan } from "../src/features/shared/tooling/verify";
import { runNodeCli } from "./helpers/run-cli";

const verifyScriptPath = path.join(process.cwd(), "scripts", "agent-verify.ts");

describe("agent verify CLI", () => {
  it("prints no mandatory gate for ordinary documentation-only changes", async () => {
    const { stdout } = await runNodeCli(
      ["--experimental-strip-types", verifyScriptPath, "docs/database.md"],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY none");
    expect(stdout).toContain("COMMAND none");
    expect(stdout).toContain("REASON documentation-only change");
  });

  it("adds agent:check for agent-facing docs and skills", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        verifyScriptPath,
        "docs/llm-kit/README.md",
        ".agents/skills/web-giapponese-page-builder/SKILL.md"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY agent");
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm agent:check -- --allow-protected-paths"
    );
    expect(stdout).toContain("REASON agent-facing docs or skills changed");
  });

  it("uses targeted vitest for direct test file changes", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        verifyScriptPath,
        "tests/content-scope-cli.test.ts",
        "tests/agent-check.test.ts"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY targeted");
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm test -- tests/agent-check.test.ts tests/content-scope-cli.test.ts"
    );
    expect(stdout).toContain("REASON test-only change");
  });

  it("keeps targeted vitest when direct test changes are mixed with ordinary docs", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        verifyScriptPath,
        "tests/content-scope-cli.test.ts",
        "docs/database.md"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY targeted");
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm test -- tests/content-scope-cli.test.ts"
    );
    expect(stdout).toContain("REASON direct test file changed");
  });

  it("uses the full check for shared test support changes", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        verifyScriptPath,
        "tests/helpers/run-cli.ts"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY check");
    expect(stdout).toContain("COMMAND ./scripts/with-node.sh pnpm check");
    expect(stdout).toContain("REASON test support changed");
  });

  it("recommends check and release:check for routing changes", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        verifyScriptPath,
        "src/app/review/page.tsx"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY release");
    expect(stdout).toContain("COMMAND ./scripts/with-node.sh pnpm check");
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm release:check"
    );
    expect(stdout).toContain("REASON release-sensitive app surface changed");
  });

  it("recommends check and release:check for E2E-covered UI surface changes", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        verifyScriptPath,
        "src/components/review/review-page.tsx"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY release");
    expect(stdout).toContain("COMMAND ./scripts/with-node.sh pnpm check");
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm release:check"
    );
    expect(stdout).toContain("REASON release-sensitive app surface changed");
  });

  it("recommends release:check for the E2E-covered dashboard component", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        verifyScriptPath,
        "src/components/dashboard/dashboard-home.tsx"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY release");
    expect(stdout).toContain("COMMAND ./scripts/with-node.sh pnpm check");
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm release:check"
    );
  });

  it("recommends release:check for global shell and navigation surfaces covered by E2E", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        verifyScriptPath,
        "src/components/site-shell.tsx",
        "src/components/site-shell-primary-nav.tsx",
        "src/features/navigation/nav.ts"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY release");
    expect(stdout).toContain("COMMAND ./scripts/with-node.sh pnpm check");
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm release:check"
    );
  });

  it("recommends release:check for settings and pitch accent surfaces covered by E2E", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        verifyScriptPath,
        "src/components/settings/settings-page.tsx",
        "src/features/settings/server/index.ts",
        "src/components/pitch-accent/pitch-accent-page.tsx",
        "src/features/pitch-accent/server/page-data.ts"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY release");
    expect(stdout).toContain("COMMAND ./scripts/with-node.sh pnpm check");
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm release:check"
    );
  });

  it("recommends final content validation and import commands for content media changes", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        verifyScriptPath,
        "content/media/duel-masters-dm25/textbook/082-live-duel-encounters-bandasuperu-zogujigusu.md",
        "content/media/duel-masters-dm25/cards/082-live-duel-encounters-bandasuperu-zogujigusu.md"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY content");
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm content:validate -- --media-slug duel-masters-dm25"
    );
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm content:import -- --media-slug duel-masters-dm25 --lesson-slug live-duel-encounters-bandasuperu-zogujigusu"
    );
    expect(stdout).not.toContain("content:scope");
    expect(stdout).toContain(
      "NOTE follow the relevant repo-scoped skill Verification section"
    );
  });

  it("normalizes absolute repository paths before choosing content gates", async () => {
    const textbookPath = path.resolve(
      "content/media/duel-masters-dm25/textbook/082-live-duel-encounters-bandasuperu-zogujigusu.md"
    );
    const cardsPath = path.resolve(
      "content/media/duel-masters-dm25/cards/082-live-duel-encounters-bandasuperu-zogujigusu.md"
    );
    const { stdout } = await runNodeCli(
      ["--experimental-strip-types", verifyScriptPath, textbookPath, cardsPath],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY content");
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm content:validate -- --media-slug duel-masters-dm25"
    );
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm content:import -- --media-slug duel-masters-dm25 --lesson-slug live-duel-encounters-bandasuperu-zogujigusu"
    );
    expect(stdout).not.toContain("IGNORED");
  });

  it("uses full final content gates for the whole content media root", async () => {
    const { stdout } = await runNodeCli(
      ["--experimental-strip-types", verifyScriptPath, "content/media"],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY content");
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm content:validate"
    );
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm content:import"
    );
    expect(stdout).not.toContain("content:scope");
    expect(stdout).toContain(
      "WARNING content media root path requires full content gates"
    );
  });

  it("treats the trailing slash content media root as the whole content media root", async () => {
    const { stdout } = await runNodeCli(
      ["--experimental-strip-types", verifyScriptPath, "content/media/"],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY content");
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm content:validate"
    );
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm content:import"
    );
    expect(stdout).not.toContain("content:scope");
  });

  it("does not emit content:scope from the exported planner without resolved content gates", () => {
    const plan = buildAgentVerifyPlan({
      paths: [
        path.resolve(
          "content/media/duel-masters-dm25/textbook/082-live-duel-encounters-bandasuperu-zogujigusu.md"
        )
      ]
    });

    expect(plan.mode).toBe("content");
    expect(plan.commands).toEqual([]);
    expect(plan.warnings).toContain(
      "content media paths require resolved content gates"
    );
  });

  it("does not fall back to content:scope when content changes need no final gate", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        verifyScriptPath,
        "content/media/duel-masters-dm25/workflow/image-requests.yaml"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY content");
    expect(stdout).toContain("COMMAND none");
    expect(stdout).toContain(
      "NOTE content import not required for duel-masters-dm25"
    );
    expect(stdout).not.toContain("content:scope");
  });

  it("classifies root config and setup files as application/tooling changes", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        verifyScriptPath,
        "tsconfig.json",
        "vitest.config.ts",
        ".env.example"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERIFY check");
    expect(stdout).toContain("COMMAND ./scripts/with-node.sh pnpm check");
    expect(stdout).toContain("REASON application code or tooling changed");
  });

  it("emits stable JSON for automation", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        verifyScriptPath,
        "--json",
        "src/features/content/importer/index.ts",
        "docs/llm-kit/README.md"
      ],
      { timeoutMs: 60_000 }
    );

    const payload = JSON.parse(stdout) as {
      commands: string[];
      mode: string;
      reasons: string[];
    };

    expect(payload).toMatchObject({
      commands: [
        "./scripts/with-node.sh pnpm check",
        "./scripts/with-node.sh pnpm release:check",
        "./scripts/with-node.sh pnpm agent:check -- --allow-protected-paths"
      ],
      mode: "release",
      reasons: [
        "agent-facing docs or skills changed",
        "application code or tooling changed",
        "release-sensitive app surface changed"
      ]
    });
  });
});
