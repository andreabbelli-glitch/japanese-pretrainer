import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { SettingsPage } from "@/components/settings/settings-page";

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

describe("settings page", () => {
  it("renders logout only as the final account setting when auth is enabled", () => {
    clearAuthEnv();
    process.env.AUTH_USERNAME = "owner";
    process.env.AUTH_PASSWORD = "study-hard";
    process.env.AUTH_SESSION_SECRET = "super-secret-session-key";

    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        saved: false,
        settings: {
          furiganaMode: "hover",
          glossaryDefaultSort: "lesson_order",
          reviewFrontFurigana: true,
          reviewDailyLimit: 20
        }
      })
    );

    expect(markup).toContain("Preferenze di studio");
    expect(markup).toContain("Salva preferenze");
    expect(markup).toContain("Furigana sul fronte");
    expect(markup).toContain("Solo dopo risposta");
    expect(markup).toContain("Esci dall&#x27;account");
    expect(markup).toContain(">Esci<");
    expect(markup.indexOf("Salva preferenze")).toBeLessThan(
      markup.indexOf("Esci dall&#x27;account")
    );
  });

  it("omits the account section when auth is disabled", () => {
    clearAuthEnv();

    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        saved: false,
        settings: {
          furiganaMode: "hover",
          glossaryDefaultSort: "lesson_order",
          reviewFrontFurigana: true,
          reviewDailyLimit: 20
        }
      })
    );

    expect(markup).not.toContain("Esci dall&#x27;account");
    expect(markup).not.toContain(">Esci<");
  });
});

function clearAuthEnv() {
  for (const key of AUTH_ENV_KEYS) {
    delete process.env[key];
  }
}
