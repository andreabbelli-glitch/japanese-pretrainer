import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { developmentFixture } from "@/db/seed";
import { withTestDatabase } from "./helpers/test-db";
import { runNodeCli } from "./helpers/run-cli";

const appProgressBriefScriptPath = path.join(
  process.cwd(),
  "scripts",
  "app-progress-brief.ts"
);

describe("app progress brief CLI", () => {
  it("loads the configured runtime DB and prints a compact media brief", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-app-progress-brief-cli-",
        seedDevelopmentFixture: true
      },
      async ({ databasePath }) => {
        const { stdout } = await runNodeCli(
          [
            "--experimental-strip-types",
            appProgressBriefScriptPath,
            "--media-slug",
            developmentFixture.mediaSlug
          ],
          {
            env: {
              DATABASE_URL: databasePath
            },
            timeoutMs: 60_000
          }
        );

        expect(stdout).toContain(
          "APP_PROGRESS_BRIEF source=runtime-db remote=false"
        );
        expect(stdout).toContain(`scope=media:${developmentFixture.mediaSlug}`);
        expect(stdout).toContain(
          `SUMMARY media=${developmentFixture.mediaSlug}`
        );
        expect(stdout).toContain("LATEST_COMPLETED_LESSON");
        expect(stdout).toContain("slug=core-vocab");
        expect(stdout).toContain(
          `/media/${developmentFixture.mediaSlug}/textbook/core-vocab`
        );
        expect(stdout).not.toContain("content:import");
      }
    );
  });

  it("rejects unsafe media slugs before querying", async () => {
    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          appProgressBriefScriptPath,
          "--media-slug",
          "../sample"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--media-slug must be a URL-safe slug segment."
      )
    });
  });

  it("refuses to create a missing local runtime database", async () => {
    const missingDatabasePath = path.join(
      process.cwd(),
      ".tmp",
      "missing-app-progress-brief.sqlite"
    );

    await expect(
      runNodeCli(["--experimental-strip-types", appProgressBriefScriptPath], {
        env: {
          DATABASE_URL: missingDatabasePath
        },
        timeoutMs: 60_000
      })
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "Local runtime database does not exist"
      )
    });
    expect(existsSync(missingDatabasePath)).toBe(false);
  });
});
