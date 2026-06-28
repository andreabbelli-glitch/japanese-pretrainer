import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  loadMobileReviewSession,
  mobileReviewNoStoreHeaders,
  verifyMobileBearerToken
} from "@/features/mobile-review/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
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

  return NextResponse.json(await loadMobileReviewSession(db), {
    headers: mobileReviewNoStoreHeaders
  });
}
