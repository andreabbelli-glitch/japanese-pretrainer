import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_DATABASE_PATH = "./data/japanese-custom-study.db";
export const DEFAULT_REPLICA_PATH = "./data/japanese-custom-study-replica.db";

export interface DatabaseLocation {
  configuredPath: string;
  databasePath?: string;
  connectionUrl: string;
  isRemote: boolean;
  replicaPath?: string;
}

export function resolveDatabaseLocation(
  databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_PATH
): DatabaseLocation {
  const normalizedUrl = databaseUrl.trim();

  if (normalizedUrl.length === 0) {
    throw new Error("DATABASE_URL must not be empty.");
  }

  if (normalizedUrl === ":memory:" || normalizedUrl === "file::memory:") {
    return {
      configuredPath: normalizedUrl,
      connectionUrl: "file::memory:",
      isRemote: false
    };
  }

  if (normalizedUrl.startsWith("file://")) {
    const databasePath = fileURLToPath(normalizedUrl);

    return {
      configuredPath: normalizedUrl,
      databasePath,
      connectionUrl: normalizedUrl,
      isRemote: false
    };
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(normalizedUrl)) {
    const replicaPath = path.resolve(process.cwd(), DEFAULT_REPLICA_PATH);

    return {
      configuredPath: normalizedUrl,
      connectionUrl: normalizedUrl,
      isRemote: true,
      replicaPath
    };
  }

  const rawPath = normalizedUrl.startsWith("file:")
    ? normalizedUrl.slice("file:".length)
    : normalizedUrl;
  const databasePath = path.resolve(process.cwd(), rawPath);

  return {
    configuredPath: normalizedUrl,
    databasePath,
    connectionUrl: pathToFileURL(databasePath).toString(),
    isRemote: false
  };
}

export function ensureDatabaseDirectory(databasePath?: string): void {
  if (!databasePath) {
    return;
  }

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}
