import {
  createHmac,
  timingSafeEqual
} from "node:crypto";

import type { KanjiClashQueueSnapshot } from "./types.ts";

const KANJI_CLASH_QUEUE_TOKEN_VERSION = 1;

type KanjiClashQueueTokenPayload = {
  queue: KanjiClashQueueSnapshot;
  version: typeof KANJI_CLASH_QUEUE_TOKEN_VERSION;
};

export function createKanjiClashQueueToken(queue: KanjiClashQueueSnapshot) {
  const payload = JSON.stringify({
    queue,
    version: KANJI_CLASH_QUEUE_TOKEN_VERSION
  } satisfies KanjiClashQueueTokenPayload);
  const encodedPayload = toBase64Url(payload);
  const signature = signKanjiClashQueueTokenPayload(
    encodedPayload,
    getKanjiClashQueueTokenSecret()
  );

  return `${encodedPayload}.${signature}`;
}

export function verifyKanjiClashQueueToken(token: string) {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signKanjiClashQueueTokenPayload(
    encodedPayload,
    getKanjiClashQueueTokenSecret()
  );

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as Partial<
      KanjiClashQueueTokenPayload
    >;

    if (
      payload.version !== KANJI_CLASH_QUEUE_TOKEN_VERSION ||
      !isKanjiClashQueueSnapshot(payload.queue)
    ) {
      return null;
    }

    return payload.queue;
  } catch {
    return null;
  }
}

function getKanjiClashQueueTokenSecret() {
  const configuredSecret = process.env.AUTH_SESSION_SECRET?.trim() ?? "";

  if (configuredSecret.length > 0) {
    return configuredSecret;
  }

  // Keep page->action round trips stable even when auth is disabled and the app
  // is restarted between render and submit. This fallback is deterministic for
  // the local workspace, so it preserves integrity checks against accidental
  // corruption, but it is not meant to be a security boundary.
  return `jcs-kanji-clash:${process.cwd()}`;
}

function signKanjiClashQueueTokenPayload(payload: string, secret: string) {
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

function isKanjiClashQueueSnapshot(
  value: unknown
): value is KanjiClashQueueSnapshot {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as KanjiClashQueueSnapshot).rounds) &&
      Array.isArray((value as KanjiClashQueueSnapshot).seenPairKeys) &&
      typeof (value as KanjiClashQueueSnapshot).mode === "string" &&
      typeof (value as KanjiClashQueueSnapshot).scope === "string" &&
      typeof (value as KanjiClashQueueSnapshot).snapshotAtIso === "string"
  );
}
