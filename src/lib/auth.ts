import {
  createHmac,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

export const AUTH_SESSION_COOKIE = "jcs_session";
export const AUTH_LOGIN_PATH = "/login";
export const APP_PATHNAME_HEADER = "x-jcs-pathname";
export const APP_SEARCH_HEADER = "x-jcs-search";
const PBKDF2_DIGEST = "sha256";
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEY_LENGTH = 32;
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

type EnabledAuthConfig = {
  enabled: true;
  passwordHash?: string;
  passwordPlaintext?: string;
  sessionSecret: string;
  username: string;
};

type DisabledAuthConfig = {
  enabled: false;
};

export type AuthConfig = EnabledAuthConfig | DisabledAuthConfig;

export function getAuthConfig(): AuthConfig {
  const username = process.env.AUTH_USERNAME?.trim() ?? "";
  const passwordHash = process.env.AUTH_PASSWORD_HASH?.trim() ?? "";
  const passwordPlaintext = process.env.AUTH_PASSWORD ?? "";
  const sessionSecret = process.env.AUTH_SESSION_SECRET?.trim() ?? "";

  const hasAnyAuthSetting = [
    username,
    passwordHash,
    passwordPlaintext,
    sessionSecret
  ].some((value) => value.length > 0);

  if (!hasAnyAuthSetting) {
    return {
      enabled: false
    };
  }

  const missingKeys: string[] = [];

  if (username.length === 0) {
    missingKeys.push("AUTH_USERNAME");
  }

  if (sessionSecret.length === 0) {
    missingKeys.push("AUTH_SESSION_SECRET");
  }

  if (passwordHash.length === 0 && passwordPlaintext.length === 0) {
    missingKeys.push("AUTH_PASSWORD_HASH or AUTH_PASSWORD");
  }

  if (missingKeys.length > 0) {
    throw new Error(
      `Incomplete auth configuration. Missing ${missingKeys.join(", ")}.`
    );
  }

  return {
    enabled: true,
    passwordHash: passwordHash.length > 0 ? passwordHash : undefined,
    passwordPlaintext:
      passwordPlaintext.length > 0 ? passwordPlaintext : undefined,
    sessionSecret,
    username
  };
}

export function isAuthEnabled() {
  return getAuthConfig().enabled;
}

export function isLoginPath(pathname: string) {
  return pathname === AUTH_LOGIN_PATH;
}

export function readRequestPathname(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "/";
  }

  const pathname = value.trim();

  return pathname.startsWith("/") ? pathname : "/";
}

export function readRequestSearch(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  const search = value.trim();

  if (search.length === 0) {
    return "";
  }

  return search.startsWith("?") ? search : "";
}

export function createPasswordHash(password: string) {
  if (password.length === 0) {
    throw new Error("Password must not be empty.");
  }

  const salt = randomBytes(16).toString("hex");
  const derivedKey = pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    PBKDF2_DIGEST
  );

  return [
    "pbkdf2_sha256",
    String(PBKDF2_ITERATIONS),
    salt,
    derivedKey.toString("hex")
  ].join("$");
}

export function verifyLoginCredentials(input: {
  password: string;
  username: string;
}) {
  const config = getAuthConfig();

  if (!config.enabled) {
    return false;
  }

  if (!safeEqual(input.username.trim(), config.username)) {
    return false;
  }

  if (config.passwordHash) {
    return verifyPasswordHash(input.password, config.passwordHash);
  }

  return safeEqual(input.password, config.passwordPlaintext ?? "");
}

export function createSessionToken(now = Date.now()) {
  const config = getAuthConfig();

  if (!config.enabled) {
    throw new Error("Cannot create a session when auth is disabled.");
  }

  const payload = JSON.stringify({
    exp: now + SESSION_DURATION_MS,
    usr: config.username
  });
  const encodedPayload = toBase64Url(payload);
  const signature = signSessionPayload(encodedPayload, config.sessionSecret);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string, now = Date.now()) {
  const config = getAuthConfig();

  if (!config.enabled) {
    return true;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = signSessionPayload(
    encodedPayload,
    config.sessionSecret
  );

  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as {
      exp?: number;
      usr?: string;
    };

    return (
      typeof payload.exp === "number" &&
      payload.exp > now &&
      typeof payload.usr === "string" &&
      safeEqual(payload.usr, config.username)
    );
  } catch {
    return false;
  }
}

export function hasValidSessionToken(
  token: string | null | undefined,
  now = Date.now()
) {
  return typeof token === "string" && token.length > 0
    ? verifySessionToken(token, now)
    : false;
}

export function getSessionCookieOptions(now = Date.now()) {
  return {
    expires: new Date(now + SESSION_DURATION_MS),
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

function verifyPasswordHash(password: string, storedHash: string) {
  const [algorithm, rawIterations, salt, expectedHash] = storedHash.split("$");

  if (
    algorithm !== "pbkdf2_sha256" ||
    !rawIterations ||
    !salt ||
    !expectedHash
  ) {
    return false;
  }

  const iterations = Number.parseInt(rawIterations, 10);

  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const actualHash = pbkdf2Sync(
    password,
    salt,
    iterations,
    Buffer.from(expectedHash, "hex").length,
    PBKDF2_DIGEST
  ).toString("hex");

  return safeEqual(actualHash, expectedHash);
}

function signSessionPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
