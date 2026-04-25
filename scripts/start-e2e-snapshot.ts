import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import { closeDatabaseClient, createDatabaseClient } from "../src/db/client.ts";
import { runMigrations } from "../src/db/migrate.ts";
import { backfillReviewSubjectState } from "../src/lib/review-subject-state-backfill.ts";
import { purgeArchivedMedia } from "../src/db/purge-archived-media.ts";
import { importContentWorkspace } from "../src/lib/content/importer.ts";

const START_E2E_SNAPSHOT_VERSION = 1;
const SQLITE_ARTIFACT_SUFFIXES = ["", "-wal", "-shm", "-journal"] as const;

export type StartE2EDatabaseSnapshotResult = {
  contentFingerprint: string;
  snapshotDatabasePath: string;
  status: "rebuilt" | "reused";
};

export type StartE2EDatabaseSnapshotPaths = {
  buildDatabasePath: string;
  metadataPath: string;
  snapshotDatabasePath: string;
};

type StartE2ESnapshotMetadata = {
  contentFingerprint: string;
  rebuiltAt: string;
  version: number;
};

export function resolveStartE2EDatabaseSnapshotPaths(
  databasePath: string
): StartE2EDatabaseSnapshotPaths {
  const resolvedDatabasePath = path.resolve(databasePath);
  const parsedPath = path.parse(resolvedDatabasePath);
  const snapshotDatabasePath = path.join(
    parsedPath.dir,
    `${parsedPath.name}.snapshot${parsedPath.ext}`
  );

  return {
    buildDatabasePath: path.join(
      parsedPath.dir,
      `${parsedPath.name}.snapshot.build${parsedPath.ext}`
    ),
    metadataPath: path.join(
      parsedPath.dir,
      `${parsedPath.name}.snapshot.meta.json`
    ),
    snapshotDatabasePath
  };
}

export async function computeStartE2EContentFingerprint(input: {
  contentRoot: string;
  drizzleRoot?: string;
}): Promise<string> {
  const hash = createHash("sha256");
  const roots = [
    path.join(path.resolve(input.contentRoot), "media"),
    path.resolve(input.drizzleRoot ?? path.join(process.cwd(), "drizzle"))
  ];

  hash.update(String(START_E2E_SNAPSHOT_VERSION));

  for (const root of roots) {
    hash.update("|");
    hash.update(root);

    await hashPathTree(root, hash, root);
  }

  return hash.digest("hex");
}

export async function ensureStartE2EDatabaseSnapshot(input: {
  contentRoot: string;
  databasePath: string;
}): Promise<StartE2EDatabaseSnapshotResult> {
  const contentFingerprint = await computeStartE2EContentFingerprint({
    contentRoot: input.contentRoot
  });
  const paths = resolveStartE2EDatabaseSnapshotPaths(input.databasePath);
  const snapshotIsValid = await isStartE2EDatabaseSnapshotValid(
    paths,
    contentFingerprint
  );

  if (!snapshotIsValid) {
    await rebuildStartE2EDatabaseSnapshot({
      contentFingerprint,
      contentRoot: input.contentRoot,
      paths
    });
  }

  await copySqliteDatabaseArtifacts(
    paths.snapshotDatabasePath,
    input.databasePath
  );

  return {
    contentFingerprint,
    snapshotDatabasePath: paths.snapshotDatabasePath,
    status: snapshotIsValid ? "reused" : "rebuilt"
  };
}

async function rebuildStartE2EDatabaseSnapshot(input: {
  contentFingerprint: string;
  contentRoot: string;
  paths: StartE2EDatabaseSnapshotPaths;
}) {
  await removeSqliteDatabaseArtifacts(input.paths.buildDatabasePath);

  const database = createDatabaseClient({
    databaseUrl: input.paths.buildDatabasePath
  });
  let buildSucceeded = false;

  try {
    await runMigrations(database);

    const importResult = await importContentWorkspace({
      contentRoot: input.contentRoot,
      database
    });

    if (importResult.status === "failed") {
      const issueDetails = importResult.issues
        .map(
          (issue) =>
            `[${issue.category}] ${issue.code} - ${issue.location.filePath} - ${issue.message}`
        )
        .join("\n");

      throw new Error(
        [importResult.message, issueDetails.length > 0 ? issueDetails : null]
          .filter((value): value is string => value !== null)
          .join("\n")
      );
    }

    await purgeArchivedMedia(database);
    await backfillReviewSubjectState(database);
  } finally {
    closeDatabaseClient(database);
  }

  await removeSqliteDatabaseArtifacts(input.paths.snapshotDatabasePath);

  try {
    await copySqliteDatabaseArtifacts(
      input.paths.buildDatabasePath,
      input.paths.snapshotDatabasePath
    );
    await writeStartE2ESnapshotMetadata(input.paths.metadataPath, {
      contentFingerprint: input.contentFingerprint,
      rebuiltAt: new Date().toISOString(),
      version: START_E2E_SNAPSHOT_VERSION
    });
    buildSucceeded = true;
  } finally {
    if (!buildSucceeded) {
      await removeSqliteDatabaseArtifacts(input.paths.snapshotDatabasePath);
    }

    await removeSqliteDatabaseArtifacts(input.paths.buildDatabasePath);
  }
}

async function isStartE2EDatabaseSnapshotValid(
  paths: StartE2EDatabaseSnapshotPaths,
  contentFingerprint: string
) {
  const [metadata, snapshotStat] = await Promise.all([
    readStartE2ESnapshotMetadata(paths.metadataPath),
    statOrNull(paths.snapshotDatabasePath)
  ]);

  return Boolean(
    metadata &&
    metadata.version === START_E2E_SNAPSHOT_VERSION &&
    metadata.contentFingerprint === contentFingerprint &&
    snapshotStat?.isFile()
  );
}

async function readStartE2ESnapshotMetadata(metadataPath: string) {
  const metadataText = await readFileOrNull(metadataPath);

  if (!metadataText) {
    return null;
  }

  try {
    const metadata = JSON.parse(
      metadataText
    ) as Partial<StartE2ESnapshotMetadata>;

    if (
      typeof metadata.version !== "number" ||
      typeof metadata.contentFingerprint !== "string"
    ) {
      return null;
    }

    return {
      contentFingerprint: metadata.contentFingerprint,
      rebuiltAt:
        typeof metadata.rebuiltAt === "string" ? metadata.rebuiltAt : "",
      version: metadata.version
    };
  } catch {
    return null;
  }
}

async function writeStartE2ESnapshotMetadata(
  metadataPath: string,
  metadata: StartE2ESnapshotMetadata
) {
  await mkdir(path.dirname(metadataPath), { recursive: true });
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
}

async function copySqliteDatabaseArtifacts(
  sourceBasePath: string,
  targetBasePath: string
) {
  await mkdir(path.dirname(targetBasePath), { recursive: true });
  await removeSqliteDatabaseArtifacts(targetBasePath);

  for (const suffix of SQLITE_ARTIFACT_SUFFIXES) {
    const sourcePath = `${sourceBasePath}${suffix}`;
    const targetPath = `${targetBasePath}${suffix}`;

    if (await statOrNull(sourcePath)) {
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function removeSqliteDatabaseArtifacts(basePath: string) {
  await Promise.all(
    SQLITE_ARTIFACT_SUFFIXES.map((suffix) =>
      rm(`${basePath}${suffix}`, { force: true })
    )
  );
}

async function hashPathTree(
  rootPath: string,
  hash: ReturnType<typeof createHash>,
  currentPath = rootPath
) {
  const currentStat = await statOrNull(currentPath);

  if (!currentStat) {
    hash.update("|missing");
    hash.update(currentPath);
    return;
  }

  const relativePath = path.relative(rootPath, currentPath) || ".";

  if (currentStat.isFile()) {
    hash.update("|file");
    hash.update(relativePath);
    hash.update("|");
    hash.update(String(currentStat.size));
    hash.update("|");
    hash.update(String(currentStat.mtimeMs));
    return;
  }

  if (!currentStat.isDirectory()) {
    hash.update("|other");
    hash.update(relativePath);
    return;
  }

  hash.update("|dir");
  hash.update(relativePath);

  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    await hashPathTree(rootPath, hash, path.join(currentPath, entry.name));
  }
}

async function statOrNull(filePath: string) {
  try {
    return await stat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function readFileOrNull(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}
