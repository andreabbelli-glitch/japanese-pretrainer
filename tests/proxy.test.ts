import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import {
  config,
  isMobileReviewApiPath,
  isStaticMediaAudioPath,
  proxy
} from "@/proxy";

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

  it("lets the Daily Kanji iOS dataset route reach its own bearer-token auth", () => {
    enableAuth();

    const response = proxy(
      new NextRequest("https://example.test/api/daily-kanji/ios-dataset")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("lets Daily Kanji mobile review routes reach their own bearer-token auth", () => {
    enableAuth();

    for (const pathname of [
      "/api/mobile/review/session",
      "/api/mobile/review/grade",
      "/api/mobile/review/device-token",
      "/api/internal/mobile-review-notifications/run"
    ]) {
      const response = proxy(
        new NextRequest(`https://example.test${pathname}`)
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("keeps redirecting regular unauthenticated app requests to login", () => {
    enableAuth();

    const response = proxy(new NextRequest("https://example.test/settings"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://example.test/login?next=%2Fsettings"
    );
  });

  it("bypasses static media audio even when auth is enabled", () => {
    enableAuth();

    const response = proxy(
      new NextRequest(
        "https://example.test/media-audio/sample-media/audio/term/yomu.mp3?v=2026-01-02T03%3A04%3A05.000Z"
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps media audio out of the real Next proxy matcher", () => {
    expect(matchesConfiguredProxy("/media-audio")).toBe(false);
    expect(matchesConfiguredProxy("/media-audio/sample/audio/yomu.mp3")).toBe(
      false
    );
    expect(matchesConfiguredProxy("/media-audio-admin")).toBe(true);
    expect(matchesConfiguredProxy("/media-audiox")).toBe(true);
    expect(isStaticMediaAudioPath("/media-audio/sample/audio/yomu.mp3")).toBe(
      true
    );
    expect(isStaticMediaAudioPath("/media-audio-admin")).toBe(false);
    expect(isStaticMediaAudioPath("/media/sample/assets/audio/yomu.mp3")).toBe(
      false
    );
    expect(isMobileReviewApiPath("/api/mobile/review/session")).toBe(true);
    expect(isMobileReviewApiPath("/api/mobile/reviewx")).toBe(false);
  });
});

function enableAuth() {
  process.env.AUTH_PASSWORD = "study-hard";
  process.env.AUTH_SESSION_SECRET = "session-secret";
  process.env.AUTH_USERNAME = "owner";
  delete process.env.AUTH_PASSWORD_HASH;
}

function matchesConfiguredProxy(pathname: string) {
  return new RegExp(`^${config.matcher[0]}$`, "u").test(pathname);
}
