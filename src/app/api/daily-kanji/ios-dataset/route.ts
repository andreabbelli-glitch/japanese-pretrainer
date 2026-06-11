import { NextResponse } from "next/server";

import { db } from "@/db";
import { buildDailyKanjiDataset } from "@/features/daily-kanji/server";
import { matchesSecret } from "@/features/security/server/secret-compare";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0"
};

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
      {
        headers: noStoreHeaders,
        status: 503
      }
    );
  }

  const providedSecret = parseBearerToken(request.headers.get("authorization"));

  if (!matchesSecret(providedSecret, configuredSecret)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      {
        headers: noStoreHeaders,
        status: 401
      }
    );
  }

  try {
    const dataset = await buildDailyKanjiDataset({
      database: db
    });

    return NextResponse.json(dataset, {
      headers: noStoreHeaders
    });
  } catch (error) {
    console.error("Daily Kanji iOS dataset generation failed.", error);

    return NextResponse.json(
      {
        error: "Daily Kanji dataset generation failed.",
        ok: false
      },
      {
        headers: noStoreHeaders,
        status: 500
      }
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
