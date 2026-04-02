import { describe, expect, it } from "vitest";

import {
  buildStartE2ERuntimeEnv,
  resolveStartE2EDatabaseUrl
} from "../scripts/start-e2e-config";

function asProcessEnv(values: Record<string, string>) {
  return values as unknown as NodeJS.ProcessEnv;
}

describe("start-e2e database resolution", () => {
  it("defaults to the isolated E2E sqlite database when DATABASE_URL is remote", () => {
    expect(
      resolveStartE2EDatabaseUrl(asProcessEnv({
        DATABASE_URL: "libsql://example.turso.io"
      }))
    ).toContain(".tmp/e2e/japanese-custom-study-e2e.sqlite");
  });

  it("keeps an explicit local DATABASE_URL override", () => {
    expect(
      resolveStartE2EDatabaseUrl(asProcessEnv({
        DATABASE_URL: "./data/custom-e2e.sqlite"
      }))
    ).toBe("./data/custom-e2e.sqlite");
  });

  it("allows an explicit E2E_DATABASE_URL override to win", () => {
    expect(
      resolveStartE2EDatabaseUrl(asProcessEnv({
        DATABASE_URL: "libsql://example.turso.io",
        E2E_DATABASE_URL: "file:///tmp/explicit-e2e.sqlite"
      }))
    ).toBe("file:///tmp/explicit-e2e.sqlite");
  });

  it("writes the resolved E2E database URL into the runtime env for next start", () => {
    const runtimeEnv = buildStartE2ERuntimeEnv(asProcessEnv({
      DATABASE_URL: "libsql://example.turso.io",
      E2E_DATABASE_URL: "file:///tmp/explicit-e2e.sqlite",
      AUTH_PASSWORD: "keep-out"
    }));

    expect(runtimeEnv.DATABASE_URL).toBe("file:///tmp/explicit-e2e.sqlite");
    expect(runtimeEnv.AUTH_PASSWORD).toBe("");
    expect(runtimeEnv.AUTH_PASSWORD_HASH).toBe("");
    expect(runtimeEnv.AUTH_SESSION_SECRET).toBe("");
    expect(runtimeEnv.AUTH_USERNAME).toBe("");
  });
});
