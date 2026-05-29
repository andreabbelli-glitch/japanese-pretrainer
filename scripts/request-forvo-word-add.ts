import path from "node:path";
import { spawn } from "node:child_process";

import { MAX_TIMER_DELAY_MS } from "../src/features/pronunciation/tooling/fetch-throttle.ts";
import {
  addForvoWordAddRequestEntry,
  buildForvoWordAddUrl,
  hasCurrentForvoWordAddRequestForEntry,
  loadForvoKnownMissingRegistry,
  loadForvoWordAddRequestRegistry,
  persistForvoWordAddRequestRegistry
} from "../src/features/pronunciation/index.ts";

type CliOptions = {
  dryRun: boolean;
  entryIds: string[];
  knownMissingPath: string;
  limit?: number;
  mediaSlugs: string[];
  openUrls: boolean;
  requestDelayMs: number;
  requestRegistryPath: string;
  retryBlocked: boolean;
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

  return !hasCurrentForvoWordAddRequestForEntry(requestRegistry, {
    entryId: entry.entryId,
    entryKind: entry.entryKind,
    label: entry.label,
    mediaSlug: entry.mediaSlug,
    reading: entry.reading
  });
}) as Array<
  (typeof knownMissingRegistry.entries)[number] & {
    label: string;
  }
>;

if (filteredEntries.length === 0) {
  console.info("No known-missing entries matched the requested filters.");
} else {
  const requestableEntryCount = filteredEntries.filter((entry) => {
    if (entry.wordAddBlockedReason && !options.retryBlocked) {
      return false;
    }

    return Boolean(
      buildForvoWordAddUrl({
        entryId: entry.entryId,
        entryKind: entry.entryKind,
        label: entry.label,
        reading: entry.reading
      })
    );
  }).length;
  const openedLimit =
    typeof options.limit === "number"
      ? Math.min(options.limit, requestableEntryCount)
      : requestableEntryCount;
  let openedCount = 0;

  for (const entry of filteredEntries) {
    if (entry.wordAddBlockedReason && !options.retryBlocked) {
      console.info(
        `${entry.mediaSlug}:${entry.entryKind}:${entry.entryId} -> skipped (Forvo word-add blocked: ${entry.wordAddBlockedReason})`
      );
      continue;
    }

    const requestUrl = buildForvoWordAddUrl({
      entryId: entry.entryId,
      entryKind: entry.entryKind,
      label: entry.label,
      reading: entry.reading
    });

    if (!requestUrl) {
      console.info(
        `${entry.mediaSlug}:${entry.entryKind}:${entry.entryId} -> skipped (no Japanese Forvo query)`
      );
      continue;
    }

    if (typeof options.limit === "number" && openedCount >= options.limit) {
      break;
    }

    console.info(
      `${entry.mediaSlug}:${entry.entryKind}:${entry.entryId} -> ${requestUrl}`
    );

    if (!options.dryRun) {
      if (options.openUrls) {
        await openUrlInDefaultBrowser(requestUrl);
      }

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
    }

    openedCount += 1;

    if (openedCount < openedLimit && options.openUrls && !options.dryRun) {
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
    retryBlocked: false,
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
      options.requestDelayMs = readNonNegativeTimerDelayOption(
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

    if (argument === "--retry-blocked") {
      options.retryBlocked = true;
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

function readNonNegativeTimerDelayOption(
  argv: string[],
  index: number,
  flag: string
) {
  const parsed = readNonNegativeIntegerOption(argv, index, flag);

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${flag} must be a safe non-negative integer.`);
  }

  if (parsed > MAX_TIMER_DELAY_MS) {
    throw new Error(`${flag} must be at most ${MAX_TIMER_DELAY_MS} ms.`);
  }

  return parsed;
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
