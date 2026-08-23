import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  gradeMobileReviewCard,
  mobileReviewNoStoreHeaders,
  verifyMobileBearerToken
} from "@/features/mobile-review/server";
import type { ReviewRating } from "@/features/review/model/scheduler";

const REVIEW_CARD_OUT_OF_DATE_ERROR_MESSAGE = "Review card is out of date.";
const validRatings = new Set<ReviewRating>(["again", "hard", "good", "easy"]);

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

  const body = await parseJsonBody(request);
  const cardId = readRequiredString(body, "cardId");
  const rating = readRating(body);
  const expectedUpdatedAt = readRequiredFreshnessToken(body);

  if (!cardId || !rating || expectedUpdatedAt === undefined) {
    return NextResponse.json(
      { error: "Invalid mobile review grade request.", ok: false },
      { headers: mobileReviewNoStoreHeaders, status: 400 }
    );
  }

  try {
    return NextResponse.json(
      await gradeMobileReviewCard({
        cardId,
        database: db,
        expectedUpdatedAt,
        hasBufferedSuccessor: body?.hasBufferedSuccessor === true,
        rating,
        responseMs: readOptionalResponseMs(body)
      }),
      { headers: mobileReviewNoStoreHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === REVIEW_CARD_OUT_OF_DATE_ERROR_MESSAGE ? 409 : 500;

    return NextResponse.json(
      {
        error: message,
        ok: false
      },
      { headers: mobileReviewNoStoreHeaders, status }
    );
  }
}

async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readRequiredString(body: Record<string, unknown> | null, key: string) {
  const value = body?.[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readRating(body: Record<string, unknown> | null) {
  const rating = readRequiredString(body, "rating");

  return rating && validRatings.has(rating as ReviewRating)
    ? (rating as ReviewRating)
    : null;
}

function readRequiredFreshnessToken(body: Record<string, unknown> | null) {
  const value = body?.expectedUpdatedAt;

  if (value === null) {
    return null;
  }

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readOptionalResponseMs(body: Record<string, unknown> | null) {
  const value = body?.responseMs;

  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
