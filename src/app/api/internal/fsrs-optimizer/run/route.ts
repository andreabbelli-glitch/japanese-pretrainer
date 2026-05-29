import { NextResponse } from "next/server";

import { db } from "@/db";
import { runFsrsOptimizer } from "@/features/fsrs-optimizer/tooling/trainer";
import { matchesSecret } from "@/features/security/server/secret-compare";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();

  if (!configuredSecret) {
    return NextResponse.json(
      {
        error: "CRON_SECRET is not configured on the app runtime."
      },
      { status: 503 }
    );
  }

  const providedSecret = parseBearerToken(request.headers.get("authorization"));

  if (!matchesSecret(providedSecret, configuredSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runFsrsOptimizer({
      database: db
    });

    return NextResponse.json({
      ok: true,
      result
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

function parseBearerToken(authorization: string | null) {
  const prefix = "Bearer ";

  if (!authorization?.startsWith(prefix)) {
    return null;
  }

  const token = authorization.slice(prefix.length).trim();

  return token.length > 0 ? token : null;
}
