import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_DATABASE_PATH = "./data/japanese-custom-study.db";

export interface DatabaseLocation {
  configuredPath: string;
  databasePath?: string;
  connectionUrl: string;
  isRemote: boolean;
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
    return {
      configuredPath: normalizedUrl,
      connectionUrl: normalizedUrl,
      isRemote: true
    };
  }

  const rawPath = normalizedUrl.startsWith("file:")
    ? normalizedUrl.slice("file:".length)
    : normalizedUrl;
  const databasePath = resolveLocalDatabasePath(rawPath);

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

function resolveLocalDatabasePath(rawPath: string) {
  if (rawPath.length === 0) {
    return process.cwd();
  }

  if (path.isAbsolute(rawPath)) {
    return path.normalize(rawPath);
  }

  return path.normalize(`${process.cwd()}${path.sep}${rawPath}`);
}
