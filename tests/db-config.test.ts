import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { resolveDatabaseLocation, shouldPreferEmbeddedReplica } from "@/db";

describe("database config", () => {
  it("keeps remote libsql urls untouched for hosted deployments", () => {
    const location = resolveDatabaseLocation("libsql://study-db.turso.io");

    expect(location).toEqual({
      configuredPath: "libsql://study-db.turso.io",
      connectionUrl: "libsql://study-db.turso.io",
      isRemote: true,
      replicaPath: path.resolve(
        process.cwd(),
        "data/japanese-custom-study-replica.db"
      )
    });
  });

  it("resolves relative sqlite paths to absolute file urls", () => {
    const location = resolveDatabaseLocation("./data/custom-study.db");

    expect(location.isRemote).toBe(false);
    expect(location.databasePath).toBe(
      path.resolve(process.cwd(), "data/custom-study.db")
    );
    expect(location.connectionUrl).toBe(
      pathToFileURL(location.databasePath!).toString()
    );
  });

  it("preserves explicit file urls as local databases", () => {
    const databasePath = path.resolve(process.cwd(), "tmp/test.sqlite");
    const connectionUrl = pathToFileURL(databasePath).toString();
    const location = resolveDatabaseLocation(connectionUrl);

    expect(location).toEqual({
      configuredPath: connectionUrl,
      connectionUrl,
      databasePath,
      isRemote: false
    });
  });

  it("enables embedded replicas only when the app bootstrap asks for it", () => {
    delete process.env.JCS_ENABLE_EMBEDDED_REPLICA;
    expect(shouldPreferEmbeddedReplica()).toBe(false);

    process.env.JCS_ENABLE_EMBEDDED_REPLICA = "1";
    expect(shouldPreferEmbeddedReplica()).toBe(true);

    delete process.env.JCS_ENABLE_EMBEDDED_REPLICA;
  });
});
