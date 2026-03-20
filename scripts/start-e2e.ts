import "dotenv/config";

import path from "node:path";
import { spawn } from "node:child_process";

import {
  closeDatabaseClient,
  createDatabaseClient,
  runMigrations
} from "../src/db/index.ts";
import { purgeArchivedMedia } from "../src/db/purge-archived-media.ts";
import { importContentWorkspace } from "../src/lib/content/importer.ts";

const database = createDatabaseClient({
  databaseUrl: process.env.DATABASE_URL
});
const contentRoot = path.resolve(process.cwd(), "content");
const runtimeEnv = createE2ERuntimeEnv(process.env);

try {
  await runMigrations(database);

  const importResult = await importContentWorkspace({
    contentRoot,
    database
  });

  if (importResult.status === "failed") {
    console.error(importResult.message);

    for (const issue of importResult.issues) {
      console.error(
        `[${issue.category}] ${issue.code} - ${issue.location.filePath} - ${issue.message}`
      );
    }

    process.exit(1);
  }

  await purgeArchivedMedia(database);
} finally {
  closeDatabaseClient(database);
}

const nextStart = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "start", "--port", "3100"],
  {
    cwd: process.cwd(),
    env: runtimeEnv,
    stdio: "inherit"
  }
);

nextStart.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

for (const eventName of ["SIGINT", "SIGTERM"] as const) {
  process.on(eventName, () => {
    nextStart.kill(eventName);
  });
}

function createE2ERuntimeEnv(sourceEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...sourceEnv,
    AUTH_PASSWORD: "",
    AUTH_PASSWORD_HASH: "",
    AUTH_SESSION_SECRET: "",
    AUTH_USERNAME: ""
  };
}
