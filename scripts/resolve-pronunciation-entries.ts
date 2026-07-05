import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

type CliOptions = {
  entriesFile?: string;
  entryIds: string[];
  mediaSlug?: string;
  preflight: boolean;
  preflightOnly: boolean;
  printCommand: boolean;
  resolveForwardArgs: string[];
  preflightForwardArgs: string[];
};

const sharedValueFlags = new Set([
  "--content-root",
  "--known-missing-file",
  "--request-registry-file",
  "--limit"
]);
const sharedBooleanFlags = new Set(["--refresh", "--retry-known-missing"]);
const resolveOnlyValueFlags = new Set([
  "--tofugu-dataset-dir",
  "--anki-app",
  "--anki-python",
  "--anki-base-dir",
  "--profile-dir",
  "--browser-timeout-ms"
]);
const resolveOnlyBooleanFlags = new Set([
  "--dry-run",
  "--keep-browser-open",
  "--no-tofugu",
  "--no-tofugu-download",
  "--no-open",
  "--no-open-word-add-on-skip"
]);

try {
  const options = await parseCliOptions(process.argv.slice(2));
  const entryIds = dedupe([
    ...options.entryIds,
    ...(options.entriesFile
      ? await readEntriesFile(path.resolve(options.entriesFile))
      : [])
  ]);

  if (!options.mediaSlug) {
    throw new Error("Missing required --media-slug <slug>.");
  }

  if (entryIds.length === 0) {
    throw new Error(
      "pronunciations:resolve-entries requires at least one --entry or --entries-file row."
    );
  }

  const preflightArgs = buildTargetedArgs({
    entryIds,
    forwardArgs: options.preflightForwardArgs,
    mediaSlug: options.mediaSlug
  });
  const resolveArgs = buildTargetedArgs({
    entryIds,
    forwardArgs: options.resolveForwardArgs,
    mediaSlug: options.mediaSlug
  });
  const shouldRunPreflight = options.preflight || options.preflightOnly;

  console.info(
    `PRONUNCIATION_RESOLVE_ENTRIES media=${options.mediaSlug} entries=${entryIds.length} preflight=${shouldRunPreflight} run=${!options.preflightOnly}`
  );

  if (options.printCommand) {
    if (shouldRunPreflight) {
      console.info(
        `COMMAND ${formatPnpmCommand("forvo:preflight", preflightArgs)}`
      );
    }

    if (!options.preflightOnly) {
      console.info(
        `COMMAND ${formatPnpmCommand("pronunciations:resolve", resolveArgs)}`
      );
    }

    process.exit(0);
  }

  if (shouldRunPreflight) {
    await runNodeScript("forvo-preflight.ts", preflightArgs);
  }

  if (!options.preflightOnly) {
    await runNodeScript("resolve-pronunciations.ts", resolveArgs);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function parseCliOptions(argv: string[]): Promise<CliOptions> {
  const normalizedArgv = expandEqualsOptions(argv);
  const options: CliOptions = {
    entryIds: [],
    preflight: false,
    preflightOnly: false,
    printCommand: false,
    preflightForwardArgs: [],
    resolveForwardArgs: []
  };

  for (let index = 0; index < normalizedArgv.length; index += 1) {
    const argument = normalizedArgv[index];

    if (argument === "--") {
      continue;
    }

    if (argument === "--media" || argument === "--media-slug") {
      options.mediaSlug = readOptionValue(normalizedArgv, index, argument);
      index += 1;
      continue;
    }

    if (argument === "--entry") {
      options.entryIds.push(readEntryId(normalizedArgv, index, "--entry"));
      index += 1;
      continue;
    }

    if (argument === "--entries-file") {
      options.entriesFile = readOptionValue(
        normalizedArgv,
        index,
        "--entries-file"
      );
      index += 1;
      continue;
    }

    if (argument === "--preflight") {
      options.preflight = true;
      continue;
    }

    if (argument === "--preflight-only") {
      options.preflightOnly = true;
      continue;
    }

    if (argument === "--print-command") {
      options.printCommand = true;
      continue;
    }

    if (argument === "--mode") {
      throw new Error(
        "pronunciations:resolve-entries is entry-only; remove --mode or use pronunciations:resolve for review, next-lesson, lesson-url, or word scopes."
      );
    }

    if (argument === "--lesson-url" || argument === "--word") {
      throw new Error(
        `pronunciations:resolve-entries does not accept ${argument}; use pronunciations:resolve for non-entry selectors.`
      );
    }

    if (argument === "--words-file") {
      throw new Error(
        "Use --entries-file with pronunciations:resolve-entries, or use pronunciations:resolve for mixed word files."
      );
    }

    const forwarded = readForwardedOption(normalizedArgv, index);

    if (!forwarded) {
      throw new Error(`Unknown argument: ${argument}`);
    }

    options.resolveForwardArgs.push(...forwarded.resolveArgs);
    options.preflightForwardArgs.push(...forwarded.preflightArgs);
    index += forwarded.consumedValues;
  }

  return options;
}

function readForwardedOption(argv: string[], index: number) {
  const argument = argv[index];

  if (sharedValueFlags.has(argument)) {
    const value =
      argument === "--limit"
        ? readNonNegativeIntegerOption(argv, index, argument)
        : readOptionValue(argv, index, argument);

    return {
      consumedValues: 1,
      preflightArgs: [argument, value],
      resolveArgs: [argument, value]
    };
  }

  if (sharedBooleanFlags.has(argument)) {
    return {
      consumedValues: 0,
      preflightArgs: [argument],
      resolveArgs: [argument]
    };
  }

  if (resolveOnlyValueFlags.has(argument)) {
    const value =
      argument === "--browser-timeout-ms"
        ? readPositiveIntegerOption(argv, index, argument)
        : readOptionValue(argv, index, argument);

    return {
      consumedValues: 1,
      preflightArgs: [],
      resolveArgs: [argument, value]
    };
  }

  if (resolveOnlyBooleanFlags.has(argument)) {
    return {
      consumedValues: 0,
      preflightArgs: [],
      resolveArgs: [argument]
    };
  }

  return null;
}

function buildTargetedArgs(input: {
  entryIds: string[];
  forwardArgs: string[];
  mediaSlug: string;
}) {
  return [
    ...input.forwardArgs,
    "--mode",
    "targeted",
    "--media",
    input.mediaSlug,
    ...input.entryIds.flatMap((entryId) => ["--entry", entryId])
  ];
}

function readEntryId(argv: string[], index: number, flag: string) {
  const value = readOptionValue(argv, index, flag);

  assertEntryId(value, flag);

  return value;
}

async function readEntriesFile(filePath: string) {
  const source = await readFile(filePath, "utf8");
  const entryIds: string[] = [];

  source.split(/\r?\n/u).forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      return;
    }

    assertEntryId(trimmed, `${filePath}:${index + 1}`);
    entryIds.push(trimmed);
  });

  return entryIds;
}

function assertEntryId(value: string, source: string) {
  if (!/^(term|grammar)-[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)) {
    throw new Error(
      `${source} must be an entry id starting with term- or grammar-.`
    );
  }
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

  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${flag} must be a safe non-negative integer.`);
  }

  return value;
}

function readPositiveIntegerOption(
  argv: string[],
  index: number,
  flag: string
) {
  const value = readOptionValue(argv, index, flag);

  if (!/^[1-9]\d*$/u.test(value)) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${flag} must be a safe positive integer.`);
  }

  return value;
}

function expandEqualsOptions(argv: string[]) {
  return argv.flatMap((argument) => {
    if (!argument.startsWith("--") || !argument.includes("=")) {
      return [argument];
    }

    const separatorIndex = argument.indexOf("=");

    return [
      argument.slice(0, separatorIndex),
      argument.slice(separatorIndex + 1)
    ];
  });
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}

function formatPnpmCommand(scriptName: string, args: string[]) {
  return ["./scripts/with-node.sh", "pnpm", scriptName, "--", ...args]
    .map(quoteShellArg)
    .join(" ");
}

function quoteShellArg(value: string) {
  if (/^[A-Za-z0-9_./:=@+-]+$/u.test(value)) {
    return value;
  }

  return `'${value.replace(/'/gu, "'\\''")}'`;
}

function runNodeScript(scriptName: string, args: string[]) {
  const scriptPath = path.join(process.cwd(), "scripts", scriptName);

  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--experimental-strip-types",
        scriptPath,
        ...args
      ],
      {
        stdio: "inherit"
      }
    );

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `${scriptName} failed with signal ${signal}.`
            : `${scriptName} failed with exit code ${code ?? 1}.`
        )
      );
    });
  });
}
