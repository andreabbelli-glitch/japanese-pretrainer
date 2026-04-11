import path from "node:path";
import { spawn } from "node:child_process";

import {
  addForvoWordAddRequestEntry,
  buildForvoWordAddUrl,
  hasForvoWordAddRequestForEntry,
  loadForvoKnownMissingRegistry,
  loadForvoWordAddRequestRegistry,
  persistForvoWordAddRequestRegistry
} from "../src/lib/pronunciation.ts";

type CliOptions = {
  dryRun: boolean;
  entryIds: string[];
  knownMissingPath: string;
  limit?: number;
  mediaSlugs: string[];
  openUrls: boolean;
  requestDelayMs: number;
  requestRegistryPath: string;
  retryRequested: boolean;
};

const options = parseCliOptions(process.argv.slice(2));
const knownMissingRegistry = await loadForvoKnownMissingRegistry(
  path.resolve(options.knownMissingPath)
);
const requestRegistry = await loadForvoWordAddRequestRegistry(
  path.resolve(options.requestRegistryPath)
);

const filteredEntries = knownMissingRegistry.entries.filter((entry) => {
  if (
    options.mediaSlugs.length > 0 &&
    !options.mediaSlugs.includes(entry.mediaSlug)
  ) {
    return false;
  }

  if (
    options.entryIds.length > 0 &&
    !options.entryIds.includes(entry.entryId)
  ) {
    return false;
  }

  if (typeof entry.label !== "string" || entry.label.length === 0) {
    return false;
  }

  if (options.retryRequested) {
    return true;
  }

  return !hasForvoWordAddRequestForEntry(requestRegistry, {
    entryId: entry.entryId,
    entryKind: entry.entryKind,
    mediaSlug: entry.mediaSlug
  });
}) as Array<
  (typeof knownMissingRegistry.entries)[number] & {
    label: string;
  }
>;

const entries =
  typeof options.limit === "number" && options.limit >= 0
    ? filteredEntries.slice(0, options.limit)
    : filteredEntries;

if (entries.length === 0) {
  console.info("No known-missing entries matched the requested filters.");
} else {
  for (const [index, entry] of entries.entries()) {
    const requestUrl = buildForvoWordAddUrl({
      entryId: entry.entryId,
      entryKind: entry.entryKind,
      label: entry.label,
      reading: entry.reading
    });

    console.info(
      `${entry.mediaSlug}:${entry.entryKind}:${entry.entryId} -> ${requestUrl}`
    );

    if (!options.dryRun) {
      addForvoWordAddRequestEntry(requestRegistry, {
        entryId: entry.entryId,
        entryKind: entry.entryKind,
        label: entry.label,
        mediaSlug: entry.mediaSlug,
        reading: entry.reading
      });

      await persistForvoWordAddRequestRegistry(
        path.resolve(options.requestRegistryPath),
        requestRegistry
      );

      if (options.openUrls) {
        await openUrlInDefaultBrowser(requestUrl);
      }
    }

    if (index < entries.length - 1 && options.openUrls) {
      await sleep(options.requestDelayMs);
    }
  }
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    entryIds: [],
    knownMissingPath: path.join("data", "forvo-known-missing.json"),
    mediaSlugs: [],
    openUrls: true,
    requestDelayMs: 750,
    requestRegistryPath: path.join("data", "forvo-requested-word-add.json"),
    retryRequested: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--known-missing-file") {
      options.knownMissingPath = argv[index + 1] ?? options.knownMissingPath;
      index += 1;
      continue;
    }

    if (argument === "--request-registry-file") {
      options.requestRegistryPath =
        argv[index + 1] ?? options.requestRegistryPath;
      index += 1;
      continue;
    }

    if (argument === "--media") {
      const mediaSlug = argv[index + 1];

      if (mediaSlug) {
        options.mediaSlugs.push(mediaSlug);
      }

      index += 1;
      continue;
    }

    if (argument === "--entry") {
      const entryId = argv[index + 1];

      if (entryId) {
        options.entryIds.push(entryId);
      }

      index += 1;
      continue;
    }

    if (argument === "--limit") {
      const parsedLimit = Number.parseInt(argv[index + 1] ?? "", 10);

      if (Number.isFinite(parsedLimit) && parsedLimit >= 0) {
        options.limit = parsedLimit;
      }

      index += 1;
      continue;
    }

    if (argument === "--request-delay-ms") {
      const parsedDelay = Number.parseInt(argv[index + 1] ?? "", 10);

      if (Number.isFinite(parsedDelay) && parsedDelay >= 0) {
        options.requestDelayMs = parsedDelay;
      }

      index += 1;
      continue;
    }

    if (argument === "--retry-requested") {
      options.retryRequested = true;
      continue;
    }

    if (argument === "--no-open") {
      options.openUrls = false;
      continue;
    }

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
  }

  return options;
}

async function openUrlInDefaultBrowser(url: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("open", [url], {
      stdio: "ignore"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(`Failed to open browser URL ${url} (exit ${code ?? -1}).`)
      );
    });
  });
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
