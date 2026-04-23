import { timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { db, getMediaBySlug } from "@/db";
import {
  revalidateGlossarySummaryCache,
  revalidateMediaListCache,
  revalidateReviewSummaryCache,
  revalidateTextbookTooltipCache
} from "@/lib/data-cache";
import {
  mediaGlossaryHref,
  mediaHref,
  mediaStudyHref,
  mediaTextbookLessonHref,
  mediaTextbookLessonTooltipsHref,
  reviewHref
} from "@/lib/site";

type RevalidationRequest = {
  importId?: unknown;
  lessons?: unknown;
  mediaSlugs?: unknown;
};

export async function POST(request: Request) {
  const configuredSecret = process.env.CONTENT_CACHE_REVALIDATE_SECRET?.trim();

  if (!configuredSecret) {
    return NextResponse.json(
      {
        error:
          "CONTENT_CACHE_REVALIDATE_SECRET is not configured on the app runtime."
      },
      { status: 503 }
    );
  }

  const providedSecret = request.headers.get("x-revalidate-secret")?.trim();

  if (!matchesSecret(providedSecret, configuredSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await parseRequestBody(request);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mediaSlugs = normalizeMediaSlugs(body.mediaSlugs);
  const lessons = normalizeLessons(body.lessons);
  const mediaIds = await resolveMediaIds([
    ...mediaSlugs,
    ...lessons.map((lesson) => lesson.mediaSlug)
  ]);

  revalidateMediaListCache();
  revalidateGlossarySummaryCache();
  revalidateReviewSummaryCache();

  for (const mediaId of mediaIds) {
    revalidateGlossarySummaryCache(mediaId);
    revalidateReviewSummaryCache(mediaId);
  }

  revalidatePath("/");
  revalidatePath("/glossary");
  revalidatePath("/media");
  revalidatePath(reviewHref());

  for (const mediaSlug of mediaSlugs) {
    revalidatePath(mediaHref(mediaSlug));
    revalidatePath(mediaGlossaryHref(mediaSlug));
    revalidatePath(mediaStudyHref(mediaSlug, "glossary"));
    revalidatePath(mediaStudyHref(mediaSlug, "progress"));
    revalidatePath(mediaStudyHref(mediaSlug, "review"));
    revalidatePath(mediaStudyHref(mediaSlug, "textbook"));
  }

  for (const lesson of lessons) {
    revalidateTextbookTooltipCache(lesson);
    revalidatePath(
      mediaTextbookLessonHref(lesson.mediaSlug, lesson.lessonSlug)
    );
    revalidatePath(
      mediaTextbookLessonTooltipsHref(lesson.mediaSlug, lesson.lessonSlug)
    );
  }

  return NextResponse.json({
    importId: normalizeImportId(body.importId),
    lessonCount: lessons.length,
    mediaCount: mediaSlugs.length,
    ok: true
  });
}

async function parseRequestBody(request: Request) {
  try {
    return (await request.json()) as RevalidationRequest;
  } catch {
    return null;
  }
}

function normalizeImportId(importId: unknown) {
  return typeof importId === "string" && importId.trim() ? importId : null;
}

function normalizeMediaSlugs(mediaSlugs: unknown) {
  if (!Array.isArray(mediaSlugs)) {
    return [];
  }

  return [
    ...new Set(
      mediaSlugs
        .map((slug) => (typeof slug === "string" ? slug.trim() : ""))
        .filter(Boolean)
    )
  ];
}

async function resolveMediaIds(mediaSlugs: string[]) {
  const media = await Promise.all(
    normalizeMediaSlugs(mediaSlugs).map((mediaSlug) =>
      getMediaBySlug(db, mediaSlug)
    )
  );

  return [...new Set(media.map((entry) => entry?.id).filter(Boolean))];
}

function normalizeLessons(lessons: unknown) {
  const unique = new Map<string, { lessonSlug: string; mediaSlug: string }>();

  if (!Array.isArray(lessons)) {
    return [];
  }

  for (const lesson of lessons) {
    if (!isRecord(lesson)) {
      continue;
    }

    const mediaSlug =
      typeof lesson.mediaSlug === "string" ? lesson.mediaSlug.trim() : "";
    const lessonSlug =
      typeof lesson.lessonSlug === "string" ? lesson.lessonSlug.trim() : "";

    if (!mediaSlug || !lessonSlug) {
      continue;
    }

    unique.set(`${mediaSlug}:${lessonSlug}`, {
      lessonSlug,
      mediaSlug
    });
  }

  return [...unique.values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function matchesSecret(
  providedSecret: string | undefined,
  configuredSecret: string
) {
  if (!providedSecret) {
    return false;
  }

  const providedBuffer = Buffer.from(providedSecret);
  const configuredBuffer = Buffer.from(configuredSecret);

  if (providedBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, configuredBuffer);
}
