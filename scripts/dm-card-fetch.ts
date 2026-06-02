import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildDmCardFetchResult,
  createOfficialCardDetailUrl,
  formatDmCardFetchResult,
  isOfficialCardDetailUrl,
  isSafeOfficialCardId,
  type DmCardFetchExpectations,
  type DmCardFetchInputKind
} from "../src/features/content/tooling/dm-card-fetch.ts";

class DmCardFetchError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

const officialFetchTimeoutMs = 15_000;

try {
  const options = resolveCliOptions(process.argv.slice(2));
  const { html, inputKind, sourceUrl } = await readSource(options);
  const result = buildDmCardFetchResult({
    expectations: options.expectations,
    html,
    inputKind,
    sourceUrl
  });

  process.stdout.write(
    options.json
      ? `${JSON.stringify(result)}\n`
      : formatDmCardFetchResult(result)
  );

  if (result.status === "mismatch") {
    process.exitCode = 4;
  } else if (result.status === "not-found") {
    process.exitCode = 3;
  }
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = readExitCode(error);
}

type CliOptions = {
  expectations: DmCardFetchExpectations;
  fixtureHtml: string | null;
  fixtureUrl: string;
  json: boolean;
  officialId: string | null;
  url: string | null;
};

function resolveCliOptions(args: string[]): CliOptions {
  const expectations: DmCardFetchExpectations = {
    keywords: [],
    name: undefined,
    print: undefined,
    textLines: [],
    type: undefined
  };
  let fixtureHtml: string | null = null;
  let fixtureUrl = "https://dm.takaratomy.co.jp/card/detail/?id=fixture";
  let json = false;
  let officialId: string | null = null;
  let url: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;

    if (value === "--") {
      continue;
    }

    if (value === "--expect-keyword") {
      expectations.keywords.push(readOptionValue(args, index, value));
      index += 1;
      continue;
    }

    if (value === "--expect-name") {
      expectations.name = readSingleStringOption(
        expectations.name,
        args,
        index,
        value
      );
      index += 1;
      continue;
    }

    if (value === "--expect-print") {
      expectations.print = readSingleStringOption(
        expectations.print,
        args,
        index,
        value
      );
      index += 1;
      continue;
    }

    if (value === "--expect-text-line") {
      expectations.textLines.push(readOptionValue(args, index, value));
      index += 1;
      continue;
    }

    if (value === "--expect-type") {
      expectations.type = readSingleStringOption(
        expectations.type,
        args,
        index,
        value
      );
      index += 1;
      continue;
    }

    if (value === "--fixture-html") {
      fixtureHtml = readSingleStringOption(fixtureHtml, args, index, value);
      index += 1;
      continue;
    }

    if (value === "--fixture-url") {
      fixtureUrl = readOptionValue(args, index, value);
      assertOfficialCardUrl(fixtureUrl, "--fixture-url");
      index += 1;
      continue;
    }

    if (value === "--id" || value === "--official-id") {
      officialId = readSingleStringOption(officialId, args, index, value);
      assertSafeOfficialId(officialId, value);
      index += 1;
      continue;
    }

    if (value === "--json") {
      json = true;
      continue;
    }

    if (value === "--url") {
      url = readSingleStringOption(url, args, index, value);
      assertOfficialCardUrl(url, "--url");
      index += 1;
      continue;
    }

    if (value.startsWith("--")) {
      throw new Error(`Unknown argument: ${value}`);
    }

    throw new Error(`Unexpected positional argument: ${value}`);
  }

  const selectorCount = [fixtureHtml, officialId, url].filter(
    (value) => value !== null
  ).length;

  if (selectorCount !== 1) {
    throw new Error(
      "Provide exactly one source selector: --official-id, --url, or --fixture-html."
    );
  }

  return {
    expectations,
    fixtureHtml,
    fixtureUrl,
    json,
    officialId,
    url
  };
}

async function readSource(options: CliOptions): Promise<{
  html: string;
  inputKind: DmCardFetchInputKind;
  sourceUrl: string;
}> {
  if (options.fixtureHtml) {
    return {
      html: await readFile(path.resolve(options.fixtureHtml), "utf8"),
      inputKind: "fixture-html",
      sourceUrl: options.fixtureUrl
    };
  }

  const sourceUrl =
    options.url ?? createOfficialCardDetailUrl(options.officialId!);

  return {
    html: await fetchOfficialHtml(sourceUrl),
    inputKind: options.url ? "url" : "official-id",
    sourceUrl
  };
}

async function fetchOfficialHtml(sourceUrl: string) {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "JapaneseCustomStudy dm-card-fetch/1.0"
      },
      signal: AbortSignal.timeout(officialFetchTimeoutMs)
    });

    if (!response.ok) {
      throw new DmCardFetchError(
        `dm:card-fetch failed to fetch ${sourceUrl}: HTTP ${response.status}`,
        2
      );
    }

    return await response.text();
  } catch (error) {
    if (error instanceof DmCardFetchError) {
      throw error;
    }

    throw new DmCardFetchError(
      `dm:card-fetch failed to fetch ${sourceUrl}: ${formatUnexpectedError(
        error
      )}`,
      2
    );
  }
}

function readSingleStringOption(
  currentValue: string | null | undefined,
  args: string[],
  index: number,
  flag: string
) {
  if (currentValue !== null && currentValue !== undefined) {
    throw new Error(`${flag} cannot be provided more than once.`);
  }

  return readOptionValue(args, index, flag);
}

function readOptionValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function assertSafeOfficialId(value: string, flag: string) {
  if (!isSafeOfficialCardId(value)) {
    throw new Error(`${flag} must be a safe Duel Masters official card id.`);
  }
}

function assertOfficialCardUrl(value: string, flag: string) {
  if (!isOfficialCardDetailUrl(value)) {
    throw new Error(
      `${flag} must point to https://dm.takaratomy.co.jp/card/detail/ with a safe id.`
    );
  }
}

function formatUnexpectedError(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "dm:card-fetch failed with an unknown error.";
}

function readExitCode(error: unknown) {
  return error instanceof DmCardFetchError ? error.exitCode : 1;
}
