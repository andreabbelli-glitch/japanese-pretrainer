import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  computeStartE2EContentFingerprint,
  resolveStartE2EDatabaseSnapshotPaths
} from "../scripts/start-e2e-snapshot";

describe("start-e2e database snapshot", () => {
  it("derives snapshot artifact paths from the run database path", () => {
    expect(
      resolveStartE2EDatabaseSnapshotPaths(
        "/tmp/japanese-custom-study-e2e.sqlite"
      )
    ).toEqual({
      buildDatabasePath: "/tmp/japanese-custom-study-e2e.snapshot.build.sqlite",
      metadataPath: "/tmp/japanese-custom-study-e2e.snapshot.meta.json",
      snapshotDatabasePath: "/tmp/japanese-custom-study-e2e.snapshot.sqlite"
    });
  });

  it("changes the fingerprint when relevant content files change", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "start-e2e-snapshot-"));
    const contentRoot = path.join(tempRoot, "content");
    const mediaRoot = path.join(contentRoot, "media", "duel-masters-dm25");
    const drizzleRoot = path.join(tempRoot, "drizzle");

    await mkdir(mediaRoot, { recursive: true });
    await mkdir(drizzleRoot, { recursive: true });

    await writeFile(
      path.join(mediaRoot, "media.md"),
      "# Duel Masters\n"
    );
    await writeFile(path.join(drizzleRoot, "001.sql"), "create table x;\n");

    const initialFingerprint = await computeStartE2EContentFingerprint({
      contentRoot,
      drizzleRoot
    });

    await writeFile(
      path.join(mediaRoot, "media.md"),
      "# Duel Masters updated\n"
    );

    const updatedFingerprint = await computeStartE2EContentFingerprint({
      contentRoot,
      drizzleRoot
    });

    expect(updatedFingerprint).not.toBe(initialFingerprint);
  });
});
