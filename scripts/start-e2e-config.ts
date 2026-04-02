import path from "node:path";

const SAFE_E2E_DATABASE_PATH = path.resolve(
  process.cwd(),
  ".tmp/e2e/japanese-custom-study-e2e.sqlite"
);

export function resolveStartE2EDatabaseUrl(
  inputEnv: NodeJS.ProcessEnv = process.env
) {
  const explicitE2EDatabaseUrl = inputEnv.E2E_DATABASE_URL?.trim();

  if (explicitE2EDatabaseUrl) {
    return explicitE2EDatabaseUrl;
  }

  const configuredDatabaseUrl = inputEnv.DATABASE_URL?.trim();

  if (configuredDatabaseUrl && isSafeLocalDatabaseUrl(configuredDatabaseUrl)) {
    return configuredDatabaseUrl;
  }

  return SAFE_E2E_DATABASE_PATH;
}

export function buildStartE2ERuntimeEnv(
  inputEnv: NodeJS.ProcessEnv = process.env
) {
  const databaseUrl = resolveStartE2EDatabaseUrl(inputEnv);

  return {
    ...inputEnv,
    AUTH_PASSWORD: "",
    AUTH_PASSWORD_HASH: "",
    AUTH_SESSION_SECRET: "",
    AUTH_USERNAME: "",
    DATABASE_URL: databaseUrl
  };
}

function isSafeLocalDatabaseUrl(databaseUrl: string) {
  if (databaseUrl === ":memory:" || databaseUrl === "file::memory:") {
    return true;
  }

  if (databaseUrl.startsWith("file://")) {
    return true;
  }

  return !/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(databaseUrl);
}
