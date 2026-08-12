import { mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "../../src/db/create-client.ts";

import { TEST_DATABASE_TEMPLATE_CONTEXT_KEY } from "./test-db-context";

type GlobalSetupContext = {
  onTestsRerun: (callback: () => Promise<void>) => void;
  provide: (
    key: typeof TEST_DATABASE_TEMPLATE_CONTEXT_KEY,
    value: string
  ) => void;
};

export default async function setupTestDatabaseTemplate(
  context: GlobalSetupContext
) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-vitest-db-template-"));
  const templatePath = path.join(tempDir, "template.sqlite");

  try {
    await rebuildTemplateDatabase(templatePath);
    context.provide(TEST_DATABASE_TEMPLATE_CONTEXT_KEY, templatePath);
    context.onTestsRerun(async () => {
      await rebuildTemplateDatabase(templatePath);
    });
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }

  return async () => {
    await rm(tempDir, { recursive: true, force: true });
  };
}

async function rebuildTemplateDatabase(templatePath: string) {
  const { runMigrations } = await import("../../src/db/migrate.ts");
  const nextTemplatePath = `${templatePath}.next`;
  let database: DatabaseClient | undefined;

  await rm(nextTemplatePath, { force: true });

  try {
    database = createDatabaseClient({
      databaseUrl: nextTemplatePath
    });
    await runMigrations(database);
    closeDatabaseClient(database);
    database = undefined;
    await rename(nextTemplatePath, templatePath);
  } catch (error) {
    if (database) {
      closeDatabaseClient(database);
    }
    await rm(nextTemplatePath, { force: true });
    throw error;
  }
}
