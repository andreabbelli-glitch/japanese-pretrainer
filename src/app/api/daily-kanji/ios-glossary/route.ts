import { NextResponse } from "next/server";

import { db } from "@/db";
import { loadDailyKanjiGlossaryRuntimeSnapshot } from "@/features/daily-kanji/server";
import { matchesSecret } from "@/features/security/server/secret-compare";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0"
};
const snapshotCacheControl = "private, max-age=604800, stale-if-error=2592000";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const configuredSecret = process.env.DAILY_KANJI_IOS_SYNC_TOKEN?.trim();

  if (!configuredSecret) {
    return NextResponse.json(
      {
        error:
          "DAILY_KANJI_IOS_SYNC_TOKEN is not configured on the app runtime."
      },
      { headers: noStoreHeaders, status: 503 }
    );
  }

  if (
    !matchesSecret(
      parseBearerToken(request.headers.get("authorization")),
      configuredSecret
    )
  ) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { headers: noStoreHeaders, status: 401 }
    );
  }

  try {
    const snapshot = await loadDailyKanjiGlossaryRuntimeSnapshot(db);

    if (!snapshot) {
      return NextResponse.json(
        {
          error: "Daily Kanji glossary snapshot is not ready.",
          ok: false
        },
        { headers: noStoreHeaders, status: 503 }
      );
    }

    const headers = {
      "Cache-Control": snapshotCacheControl,
      "Content-Type": "application/json; charset=utf-8",
      ETag: snapshot.payloadEtag,
      Vary: "Authorization",
      "X-Daily-Kanji-Generated-At": snapshot.generatedAt,
      "X-Daily-Kanji-Snapshot": "persisted-glossary"
    };

    if (
      matchesEtag(request.headers.get("if-none-match"), snapshot.payloadEtag)
    ) {
      return new Response(null, { headers, status: 304 });
    }

    return new Response(snapshot.payloadJson, { headers });
  } catch (error) {
    console.error("Daily Kanji iOS glossary snapshot load failed.", error);

    return NextResponse.json(
      {
        error: "Daily Kanji glossary snapshot is unavailable.",
        ok: false
      },
      { headers: noStoreHeaders, status: 500 }
    );
  }
}

function parseBearerToken(authorization: string | null) {
  const prefix = "Bearer ";

  if (!authorization?.startsWith(prefix)) {
    return null;
  }

  const token = authorization.slice(prefix.length).trim();

  return token.length > 0 ? token : null;
}

function matchesEtag(ifNoneMatch: string | null, etag: string) {
  if (!ifNoneMatch) {
    return false;
  }

  return ifNoneMatch
    .split(",")
    .map((candidate) => candidate.trim().replace(/^W\//u, ""))
    .some((candidate) => candidate === "*" || candidate === etag);
}
