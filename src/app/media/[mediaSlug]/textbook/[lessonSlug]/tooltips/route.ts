import { NextResponse } from "next/server";

import { getTextbookLessonTooltipEntries } from "@/lib/textbook";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    lessonSlug: string;
    mediaSlug: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { lessonSlug, mediaSlug } = await context.params;
  const entries = await getTextbookLessonTooltipEntries(mediaSlug, lessonSlug);

  if (!entries) {
    return new Response("Not found.", {
      status: 404
    });
  }

  return NextResponse.json(entries);
}
