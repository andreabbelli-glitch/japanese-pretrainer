import { timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  revalidateGlossarySummaryCache,
  revalidateMediaListCache,
  revalidateReviewSummaryCache
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
  importId?: string;
  lessons?: Array<{
    lessonSlug?: string;
    mediaSlug?: string;
  }>;
  mediaSlugs?: string[];
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

  const mediaSlugs = normalizeMediaSlugs(body.mediaSlugs ?? []);
  const lessons = normalizeLessons(body.lessons ?? []);

  revalidateMediaListCache();
  revalidateGlossarySummaryCache();
  revalidateReviewSummaryCache();

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
    revalidatePath(mediaTextbookLessonHref(lesson.mediaSlug, lesson.lessonSlug));
    revalidatePath(
      mediaTextbookLessonTooltipsHref(lesson.mediaSlug, lesson.lessonSlug)
    );
  }

  return NextResponse.json({
    importId: body.importId ?? null,
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

function normalizeMediaSlugs(mediaSlugs: string[]) {
  return [...new Set(mediaSlugs.map((slug) => slug.trim()).filter(Boolean))];
}

function normalizeLessons(
  lessons: Array<{
    lessonSlug?: string;
    mediaSlug?: string;
  }>
) {
  const unique = new Map<string, { lessonSlug: string; mediaSlug: string }>();

  for (const lesson of lessons) {
    const mediaSlug = lesson.mediaSlug?.trim();
    const lessonSlug = lesson.lessonSlug?.trim();

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

function matchesSecret(providedSecret: string | undefined, configuredSecret: string) {
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
