import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  mobileReviewNoStoreHeaders,
  saveMobileReviewDeviceToken,
  verifyMobileBearerToken
} from "@/features/mobile-review/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = verifyMobileBearerToken({
    authorization: request.headers.get("authorization"),
    configuredSecret: process.env.MOBILE_API_TOKEN
  });

  if (auth === "missing-secret") {
    return NextResponse.json(
      { error: "MOBILE_API_TOKEN is not configured on the app runtime." },
      { headers: mobileReviewNoStoreHeaders, status: 503 }
    );
  }

  if (auth === "unauthorized") {
    return NextResponse.json(
      { error: "Unauthorized." },
      { headers: mobileReviewNoStoreHeaders, status: 401 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    await saveMobileReviewDeviceToken({
      database: db,
      deviceToken: typeof body.deviceToken === "string" ? body.deviceToken : ""
    });

    return NextResponse.json(
      { ok: true },
      { headers: mobileReviewNoStoreHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";

    return NextResponse.json(
      { error: message, ok: false },
      { headers: mobileReviewNoStoreHeaders, status: 400 }
    );
  }
}
