import path from "node:path";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { closeDatabaseClient, createDatabaseClient } from "@/db";
import { runMigrations } from "@/db/migrate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);
const validContentRoot = path.resolve(
  __dirname,
  "fixtures",
  "content",
  "valid",
  "content"
);

describe("import content CLI", () => {
  let tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs = [];
  });

  it("loads .env.local before creating the importer CLI database client", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-import-cli-"));
    tempDirs.push(tempDir);
    const databasePath = path.join(tempDir, "import.sqlite");
    const database = createDatabaseClient({ databaseUrl: databasePath });
    await runMigrations(database);
    closeDatabaseClient(database);
    await writeFile(
      path.join(tempDir, ".env.local"),
      `DATABASE_URL=${databasePath}\n`
    );
    const env = { ...process.env };
    delete env.CONTENT_CACHE_REVALIDATE_SECRET;
    delete env.CONTENT_CACHE_REVALIDATE_URL;
    delete env.DATABASE_AUTH_TOKEN;
    delete env.DATABASE_URL;
    delete env.LIBSQL_AUTH_TOKEN;

    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "--experimental-strip-types",
        path.join(process.cwd(), "scripts", "import-content.ts"),
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime"
      ],
      {
        cwd: tempDir,
        env
      }
    );

    expect(stdout).toContain("Imported 1 bundle(s)");
    expect(stdout).toContain("Mode: incremental (sample-anime).");
  }, 60_000);

  it("accepts one or more lesson slugs for a media-scoped import", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-import-cli-"));
    tempDirs.push(tempDir);
    const databasePath = path.join(tempDir, "import.sqlite");
    const database = createDatabaseClient({ databaseUrl: databasePath });
    await runMigrations(database);
    closeDatabaseClient(database);
    await writeFile(
      path.join(tempDir, ".env.local"),
      `DATABASE_URL=${databasePath}\n`
    );
    const env = { ...process.env };
    delete env.CONTENT_CACHE_REVALIDATE_SECRET;
    delete env.CONTENT_CACHE_REVALIDATE_URL;
    delete env.DATABASE_AUTH_TOKEN;
    delete env.DATABASE_URL;
    delete env.LIBSQL_AUTH_TOKEN;

    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "--experimental-strip-types",
        path.join(process.cwd(), "scripts", "import-content.ts"),
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--lesson-slug",
        "ep01-intro"
      ],
      {
        cwd: tempDir,
        env
      }
    );

    expect(stdout).toContain("Imported 1 bundle(s)");
    expect(stdout).toContain("Mode: lesson (sample-anime: ep01-intro).");
  }, 60_000);

  it("rejects missing media slug values before running the importer", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-import-cli-"));
    tempDirs.push(tempDir);
    const databasePath = path.join(tempDir, "import.sqlite");
    const database = createDatabaseClient({ databaseUrl: databasePath });
    await runMigrations(database);
    closeDatabaseClient(database);
    await writeFile(
      path.join(tempDir, ".env.local"),
      `DATABASE_URL=${databasePath}\n`
    );
    const env = { ...process.env };
    delete env.CONTENT_CACHE_REVALIDATE_SECRET;
    delete env.CONTENT_CACHE_REVALIDATE_URL;
    delete env.DATABASE_AUTH_TOKEN;
    delete env.DATABASE_URL;
    delete env.LIBSQL_AUTH_TOKEN;

    await expect(
      execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          path.join(process.cwd(), "scripts", "import-content.ts"),
          "--content-root",
          validContentRoot,
          "--media-slug",
          "--content-root"
        ],
        {
          cwd: tempDir,
          env
        }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Missing value for --media-slug.")
    });
  }, 60_000);

  it("rejects lesson-scoped imports without exactly one media slug", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-import-cli-"));
    tempDirs.push(tempDir);
    const databasePath = path.join(tempDir, "import.sqlite");
    const database = createDatabaseClient({ databaseUrl: databasePath });
    await runMigrations(database);
    closeDatabaseClient(database);
    await writeFile(
      path.join(tempDir, ".env.local"),
      `DATABASE_URL=${databasePath}\n`
    );
    const env = { ...process.env };
    delete env.CONTENT_CACHE_REVALIDATE_SECRET;
    delete env.CONTENT_CACHE_REVALIDATE_URL;
    delete env.DATABASE_AUTH_TOKEN;
    delete env.DATABASE_URL;
    delete env.LIBSQL_AUTH_TOKEN;

    await expect(
      execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          path.join(process.cwd(), "scripts", "import-content.ts"),
          "--content-root",
          validContentRoot,
          "--lesson-slug",
          "ep01-intro"
        ],
        {
          cwd: tempDir,
          env
        }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "Import aborted: lesson scope requires exactly one --media-slug."
      )
    });
  }, 60_000);

  it("rejects full imports against remote databases unless explicitly allowed", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-import-cli-"));
    tempDirs.push(tempDir);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_AUTH_TOKEN: "test-token",
      DATABASE_URL: "libsql://example.turso.io"
    };
    delete env.ALLOW_REMOTE_FULL_CONTENT_IMPORT;
    delete env.CONTENT_CACHE_REVALIDATE_SECRET;
    delete env.CONTENT_CACHE_REVALIDATE_URL;
    delete env.LIBSQL_AUTH_TOKEN;

    await expect(
      execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          path.join(process.cwd(), "scripts", "import-content.ts"),
          "--content-root",
          validContentRoot
        ],
        {
          cwd: tempDir,
          env
        }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "Refusing to run a full content import against a remote DATABASE_URL."
      )
    });
  }, 60_000);
});
