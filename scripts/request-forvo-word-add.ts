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
    requestDelayMs: 3000,
    requestRegistryPath: path.join("data", "forvo-requested-word-add.json"),
    retryRequested: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--") {
      continue;
    }

    if (argument === "--known-missing-file") {
      options.knownMissingPath = readOptionValue(
        argv,
        index,
        "--known-missing-file"
      );
      index += 1;
      continue;
    }

    if (argument === "--request-registry-file") {
      options.requestRegistryPath = readOptionValue(
        argv,
        index,
        "--request-registry-file"
      );
      index += 1;
      continue;
    }

    if (argument === "--media") {
      options.mediaSlugs.push(readOptionValue(argv, index, "--media"));
      index += 1;
      continue;
    }

    if (argument === "--entry") {
      options.entryIds.push(readOptionValue(argv, index, "--entry"));
      index += 1;
      continue;
    }

    if (argument === "--limit") {
      options.limit = readNonNegativeIntegerOption(argv, index, "--limit");
      index += 1;
      continue;
    }

    if (argument === "--request-delay-ms") {
      options.requestDelayMs = readNonNegativeIntegerOption(
        argv,
        index,
        "--request-delay-ms"
      );
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

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function readOptionValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function readNonNegativeIntegerOption(
  argv: string[],
  index: number,
  flag: string
) {
  const value = readOptionValue(argv, index, flag);

  if (!/^\d+$/u.test(value)) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }

  return Number.parseInt(value, 10);
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
