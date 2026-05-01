import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "@/proxy";

const AUTH_ENV_KEYS = [
  "AUTH_PASSWORD",
  "AUTH_PASSWORD_HASH",
  "AUTH_SESSION_SECRET",
  "AUTH_USERNAME"
] as const;
const originalAuthEnv = Object.fromEntries(
  AUTH_ENV_KEYS.map((key) => [key, process.env[key]])
);

describe("proxy", () => {
  afterEach(() => {
    for (const key of AUTH_ENV_KEYS) {
      const value = originalAuthEnv[key];

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("lets the FSRS optimizer cron route reach its own bearer-token auth", () => {
    enableAuth();

    const response = proxy(
      new NextRequest("https://example.test/api/internal/fsrs-optimizer/run")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps redirecting regular unauthenticated app requests to login", () => {
    enableAuth();

    const response = proxy(new NextRequest("https://example.test/settings"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://example.test/login?next=%2Fsettings"
    );
  });
});

function enableAuth() {
  process.env.AUTH_PASSWORD = "study-hard";
  process.env.AUTH_SESSION_SECRET = "session-secret";
  process.env.AUTH_USERNAME = "owner";
  delete process.env.AUTH_PASSWORD_HASH;
}
