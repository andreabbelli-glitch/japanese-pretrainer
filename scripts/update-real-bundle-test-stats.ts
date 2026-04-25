import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { closeDatabaseClient, createDatabaseClient } from "../src/db/client.ts";
import { runMigrations } from "../src/db/migrate.ts";
import {
  card,
  cardEntryLink,
  entryLink,
  grammarAlias,
  grammarPattern,
  term,
  termAlias
} from "../src/db/schema/index.ts";
import { importContentWorkspace } from "../src/lib/content/importer.ts";
import { parseMediaDirectory } from "../src/lib/content/validator.ts";
import {
  duelMastersRealBundleStatsPath,
  type DuelMastersRealBundleStats
} from "../tests/helpers/duel-masters-real-bundle-stats.ts";

const duelMastersMediaSlug = "duel-masters-dm25";

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));
  const nextStats = await collectDuelMastersRealBundleStats(
    cliOptions.contentRoot
  );
  const formattedStats = `${JSON.stringify(nextStats, null, 2)}\n`;

  if (!cliOptions.write) {
    process.stdout.write(formattedStats);
  } else {
    const previousStats = await readExistingStats();

    await writeFile(duelMastersRealBundleStatsPath, formattedStats, "utf8");

    const status =
      previousStats === null
        ? "Created"
        : previousStats === formattedStats
          ? "Verified"
          : "Updated";

    console.info(
      `${status} ${path.relative(process.cwd(), duelMastersRealBundleStatsPath)}.`
    );
  }
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = 1;
}

async function collectDuelMastersRealBundleStats(contentRoot: string) {
  const mediaDirectory = path.join(contentRoot, "media", duelMastersMediaSlug);
  const parseResult = await parseMediaDirectory(mediaDirectory);

  if (!parseResult.ok) {
    throw new Error(
      `Could not parse '${duelMastersMediaSlug}': ${parseResult.issues.length} validation issue(s).`
    );
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-real-bundle-stats-"));
  const database = createDatabaseClient({
    databaseUrl: path.join(tempDir, "real-bundle-stats.sqlite")
  });

  try {
    await runMigrations(database);

    const importResult = await importContentWorkspace({
      contentRoot,
      mediaSlugs: [duelMastersMediaSlug],
      database
    });

    if (importResult.status === "failed") {
      throw new Error(
        `Could not import '${duelMastersMediaSlug}': ${importResult.issues.length} validation issue(s).`
      );
    }

    const [
      termCount,
      termAliasCount,
      grammarPatternCount,
      grammarAliasCount,
      entryLinkCount,
      cardCount,
      cardEntryLinkCount
    ] = await Promise.all([
      database.$count(term),
      database.$count(termAlias),
      database.$count(grammarPattern),
      database.$count(grammarAlias),
      database.$count(entryLink),
      database.$count(card),
      database.$count(cardEntryLink)
    ]);

    return {
      parser: {
        lessons: parseResult.data.lessons.length,
        cardFiles: parseResult.data.cardFiles.length,
        terms: parseResult.data.terms.length,
        grammarPatterns: parseResult.data.grammarPatterns.length,
        cards: parseResult.data.cards.length,
        references: parseResult.data.references.length
      },
      importer: {
        term: termCount,
        termAlias: termAliasCount,
        grammarPattern: grammarPatternCount,
        grammarAlias: grammarAliasCount,
        entryLink: entryLinkCount,
        card: cardCount,
        cardEntryLink: cardEntryLinkCount
      }
    } satisfies DuelMastersRealBundleStats;
  } finally {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  }
}

function resolveCliOptions(args: string[]) {
  let contentRoot = path.resolve(process.cwd(), "content");
  let write = false;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === "--") {
      continue;
    }

    if (value === "--content-root") {
      const nextValue = args[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --content-root.");
      }

      contentRoot = path.resolve(nextValue);
      index += 1;
      continue;
    }

    if (value === "--write") {
      write = true;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return {
    contentRoot,
    write
  };
}

async function readExistingStats() {
  try {
    return await readFile(duelMastersRealBundleStatsPath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "ENOENT"
  );
}

function formatUnexpectedError(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return `Failed to compute real bundle stats: ${error.message}`;
  }

  return "Failed to compute real bundle stats with an unknown error.";
}
