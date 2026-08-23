import "./load-env.ts";

import { closeDatabaseClient, db } from "../src/db/client.ts";
import {
  loadDailyKanjiGlossaryRuntimeSnapshot,
  loadDailyKanjiRuntimeSnapshot,
  refreshDailyKanjiRuntimeSnapshots,
  type DailyKanjiRuntimeSnapshot,
  type DailyKanjiSnapshotRefreshResult
} from "../src/features/daily-kanji/server/runtime-snapshot.ts";

const args = new Set(process.argv.slice(2).filter((arg) => arg !== "--"));
const supportedArgs = new Set(["--force", "--status"]);
const unknownArgs = [...args].filter((arg) => !supportedArgs.has(arg));

try {
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown option: ${unknownArgs.join(", ")}`);
  }

  if (args.has("--status")) {
    const [cards, glossary] = await Promise.all([
      loadDailyKanjiRuntimeSnapshot(db),
      loadDailyKanjiGlossaryRuntimeSnapshot(db)
    ]);

    writeResult({
      cards: cards ? toPublicSnapshot(cards) : null,
      glossary: glossary ? toPublicSnapshot(glossary) : null
    });
  } else {
    const result = await refreshDailyKanjiRuntimeSnapshots({
      database: db,
      force: args.has("--force")
    });

    writeResult({
      cards: toPublicRefreshResult(result.cards),
      glossary: toPublicRefreshResult(result.glossary)
    });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  closeDatabaseClient(db);
}

function toPublicRefreshResult(result: DailyKanjiSnapshotRefreshResult) {
  return {
    ...toPublicSnapshot(result.snapshot),
    status: result.status
  };
}

function toPublicSnapshot(snapshot: DailyKanjiRuntimeSnapshot) {
  return {
    buildDurationMs: snapshot.buildDurationMs,
    generatedAt: snapshot.generatedAt,
    payloadBytes: snapshot.payloadBytes,
    refreshNotBefore: snapshot.refreshNotBefore,
    schemaVersion: snapshot.schemaVersion
  };
}

function writeResult(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
