import { afterEach, describe, expect, it } from "vitest";

import {
  APP_SEARCH_HEADER,
  APP_PATHNAME_HEADER,
  AUTH_LOGIN_PATH,
  createPasswordHash,
  createSessionToken,
  getAuthConfig,
  getSessionCookieOptions,
  hasValidSessionToken,
  isLoginPath,
  readRequestPathname,
  readRequestSearch,
  verifyLoginCredentials,
  verifySessionToken
} from "@/lib/auth";

const AUTH_ENV_KEYS = [
  "AUTH_PASSWORD",
  "AUTH_PASSWORD_HASH",
  "AUTH_SESSION_SECRET",
  "AUTH_USERNAME"
] as const;

const originalAuthEnv = new Map<string, string | undefined>(
  AUTH_ENV_KEYS.map((key) => [key, process.env[key]])
);

afterEach(() => {
  for (const key of AUTH_ENV_KEYS) {
    const value = originalAuthEnv.get(key);

    if (typeof value === "string") {
      process.env[key] = value;
      continue;
    }

    delete process.env[key];
  }
});

describe("auth helpers", () => {
  it("stays disabled when no auth env is configured", () => {
    clearAuthEnv();

    expect(getAuthConfig()).toEqual({
      enabled: false
    });
  });

  it("fails fast when auth env is only partially configured", () => {
    clearAuthEnv();
    process.env.AUTH_USERNAME = "owner";

    expect(() => getAuthConfig()).toThrow(
      "Incomplete auth configuration. Missing AUTH_SESSION_SECRET, AUTH_PASSWORD_HASH or AUTH_PASSWORD."
    );
  });

  it("verifies plaintext credentials when configured for the simplest setup", () => {
    clearAuthEnv();
    process.env.AUTH_USERNAME = "owner";
    process.env.AUTH_PASSWORD = "secret pass";
    process.env.AUTH_SESSION_SECRET = "super-secret-session-key";

    expect(
      verifyLoginCredentials({
        password: "secret pass",
        username: "owner"
      })
    ).toBe(true);
    expect(
      verifyLoginCredentials({
        password: "secret-pass",
        username: "owner"
      })
    ).toBe(false);
  });

  it("verifies password hashes and signed sessions", () => {
    clearAuthEnv();
    process.env.AUTH_USERNAME = "owner";
    process.env.AUTH_PASSWORD_HASH = createPasswordHash("study-hard");
    process.env.AUTH_SESSION_SECRET = "super-secret-session-key";

    expect(
      verifyLoginCredentials({
        password: "study-hard",
        username: "owner"
      })
    ).toBe(true);
    expect(
      verifyLoginCredentials({
        password: "study-soft",
        username: "owner"
      })
    ).toBe(false);

    const issuedAt = Date.UTC(2026, 2, 14, 10, 0, 0);
    const token = createSessionToken(issuedAt);

    expect(verifySessionToken(token, issuedAt + 1_000)).toBe(true);
    expect(verifySessionToken(token, issuedAt + 1000 * 60 * 60 * 24 * 31)).toBe(
      false
    );
    expect(verifySessionToken(`${token}tampered`, issuedAt + 1_000)).toBe(
      false
    );
    expect(verifySessionToken(`${token}.extra`, issuedAt + 1_000)).toBe(false);
  });

  it("rejects malformed password hashes without throwing during login", () => {
    clearAuthEnv();
    process.env.AUTH_USERNAME = "owner";
    process.env.AUTH_PASSWORD_HASH = "pbkdf2_sha256$210000$salt$not-hex";
    process.env.AUTH_SESSION_SECRET = "super-secret-session-key";

    expect(
      verifyLoginCredentials({
        password: "study-hard",
        username: "owner"
      })
    ).toBe(false);
  });

  it("rejects password hashes with malformed iteration counts", () => {
    clearAuthEnv();
    process.env.AUTH_USERNAME = "owner";
    process.env.AUTH_PASSWORD_HASH = createPasswordHash("study-hard").replace(
      "$210000$",
      "$210000abc$"
    );
    process.env.AUTH_SESSION_SECRET = "super-secret-session-key";

    expect(
      verifyLoginCredentials({
        password: "study-hard",
        username: "owner"
      })
    ).toBe(false);
  });

  it("uses the same timestamp base for session cookie expiry", () => {
    const issuedAt = Date.UTC(2026, 2, 14, 10, 0, 0);

    expect(getSessionCookieOptions(issuedAt)).toMatchObject({
      expires: new Date("2026-04-13T10:00:00.000Z"),
      httpOnly: true,
      path: "/",
      sameSite: "lax"
    });
  });

  it("normalizes request pathname headers for standalone login rendering", () => {
    expect(APP_PATHNAME_HEADER).toBe("x-jcs-pathname");
    expect(APP_SEARCH_HEADER).toBe("x-jcs-search");
    expect(AUTH_LOGIN_PATH).toBe("/login");
    expect(readRequestPathname("/login")).toBe("/login");
    expect(readRequestPathname(" /media ")).toBe("/media");
    expect(readRequestPathname("https://example.com")).toBe("/");
    expect(readRequestSearch("?next=%2Fmedia")).toBe("?next=%2Fmedia");
    expect(readRequestSearch(" q=owner ")).toBe("");
    expect(readRequestSearch(null)).toBe("");
    expect(readRequestPathname(null)).toBe("/");
    expect(isLoginPath("/login")).toBe(true);
    expect(isLoginPath("/media")).toBe(false);
    expect(hasValidSessionToken(undefined)).toBe(false);
  });
});

function clearAuthEnv() {
  for (const key of AUTH_ENV_KEYS) {
    delete process.env[key];
  }
}
