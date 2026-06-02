import { readContentCacheRevalidationErrorDetails } from "./revalidation-error.ts";

const CONTENT_CACHE_REVALIDATE_TIMEOUT_MS = 15_000;

export type ContentCacheRevalidationResult = {
  message: string;
  status: "failed" | "performed" | "skipped";
};

export type RevalidatedLesson = {
  lessonSlug: string;
  mediaSlug: string;
};

export async function revalidateImportedContentCache(input: {
  importId: string;
  lessons: RevalidatedLesson[];
  mediaSlugs: string[];
}): Promise<ContentCacheRevalidationResult> {
  const revalidateUrl = process.env.CONTENT_CACHE_REVALIDATE_URL?.trim();
  const revalidateSecret = process.env.CONTENT_CACHE_REVALIDATE_SECRET?.trim();

  if (!revalidateUrl || !revalidateSecret) {
    return {
      message:
        "Import completed. Cache revalidation skipped because CONTENT_CACHE_REVALIDATE_URL or CONTENT_CACHE_REVALIDATE_SECRET is not configured.",
      status: "skipped"
    };
  }

  try {
    const response = await fetch(revalidateUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": revalidateSecret
      },
      body: JSON.stringify({
        importId: input.importId,
        lessons: dedupeLessons(input.lessons),
        mediaSlugs: [...new Set(input.mediaSlugs)]
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(CONTENT_CACHE_REVALIDATE_TIMEOUT_MS)
    });

    if (response.status >= 300 && response.status < 400) {
      return {
        message: `Import completed, but cache revalidation was redirected (${response.status}) to ${response.headers.get("location") ?? "an unknown location"}.`,
        status: "failed"
      };
    }

    if (!response.ok) {
      const details = await readContentCacheRevalidationErrorDetails(response);

      return {
        message: `Import completed, but cache revalidation failed (${response.status}). ${details}`,
        status: "failed"
      };
    }

    const payload = await readRevalidationPayload(response);

    if (!payload?.ok) {
      return {
        message:
          "Import completed, but cache revalidation returned an unexpected response body.",
        status: "failed"
      };
    }

    return {
      message: `Cache revalidation completed for import ${input.importId}.`,
      status: "performed"
    };
  } catch (error) {
    return {
      message: `Import completed, but cache revalidation failed: ${formatRevalidationError(error)}`,
      status: "failed"
    };
  }
}

export function resolveRevalidatedLessons(input: {
  lessonSlugs: string[];
  parseBundles: Array<{
    lessons: Array<{
      frontmatter: {
        slug: string;
      };
    }>;
    mediaSlug: string;
  }>;
}) {
  const lessonSlugScope = new Set(input.lessonSlugs);

  return input.parseBundles.flatMap((bundle) =>
    bundle.lessons
      .filter(
        (lesson) =>
          lessonSlugScope.size === 0 ||
          lessonSlugScope.has(lesson.frontmatter.slug)
      )
      .map((lesson) => ({
        lessonSlug: lesson.frontmatter.slug,
        mediaSlug: bundle.mediaSlug
      }))
  );
}

function dedupeLessons(lessons: RevalidatedLesson[]) {
  const unique = new Map<string, RevalidatedLesson>();

  for (const lesson of lessons) {
    unique.set(`${lesson.mediaSlug}:${lesson.lessonSlug}`, lesson);
  }

  return [...unique.values()];
}

async function readRevalidationPayload(response: Response) {
  try {
    return (await response.json()) as { ok?: boolean };
  } catch {
    return null;
  }
}

function formatRevalidationError(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return "Unknown revalidation error.";
}
