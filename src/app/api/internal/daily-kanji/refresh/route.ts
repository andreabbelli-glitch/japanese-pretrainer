import { NextResponse } from "next/server";

import { db } from "@/db";
import { refreshDailyKanjiRuntimeSnapshots } from "@/features/daily-kanji/server";
import { matchesSecret } from "@/features/security/server/secret-compare";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();

  if (!configuredSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the app runtime." },
      { status: 503 }
    );
  }

  if (
    !matchesSecret(
      parseBearerToken(request.headers.get("authorization")),
      configuredSecret
    )
  ) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await refreshDailyKanjiRuntimeSnapshots({ database: db });

    return NextResponse.json({
      ok: true,
      snapshots: {
        cards: toPublicSnapshotResult(result.cards),
        glossary: toPublicSnapshotResult(result.glossary)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: message,
        ok: false
      },
      { status: 500 }
    );
  }
}

function toPublicSnapshotResult(
  result: Awaited<ReturnType<typeof refreshDailyKanjiRuntimeSnapshots>>["cards"]
) {
  return {
    buildDurationMs: result.snapshot.buildDurationMs,
    generatedAt: result.snapshot.generatedAt,
    payloadBytes: result.snapshot.payloadBytes,
    refreshNotBefore: result.snapshot.refreshNotBefore,
    status: result.status
  };
}

function parseBearerToken(authorization: string | null) {
  const prefix = "Bearer ";

  if (!authorization?.startsWith(prefix)) {
    return null;
  }

  const token = authorization.slice(prefix.length).trim();

  return token.length > 0 ? token : null;
}
