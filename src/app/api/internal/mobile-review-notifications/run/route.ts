import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  mobileReviewNoStoreHeaders,
  runMobileReviewNotificationMonitor,
  verifyMobileBearerToken
} from "@/features/mobile-review/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = verifyMobileBearerToken({
    authorization: request.headers.get("authorization"),
    configuredSecret: process.env.MOBILE_NOTIFICATION_MONITOR_SECRET
  });

  if (auth === "missing-secret") {
    return NextResponse.json(
      {
        error:
          "MOBILE_NOTIFICATION_MONITOR_SECRET is not configured on the app runtime."
      },
      { headers: mobileReviewNoStoreHeaders, status: 503 }
    );
  }

  if (auth === "unauthorized") {
    return NextResponse.json(
      { error: "Unauthorized." },
      { headers: mobileReviewNoStoreHeaders, status: 401 }
    );
  }

  return NextResponse.json(
    await runMobileReviewNotificationMonitor({
      database: db
    }),
    { headers: mobileReviewNoStoreHeaders }
  );
}
