import { notFound } from "next/navigation";

import { LessonReaderClient } from "@/components/textbook/lesson-reader-client";
import {
  applyLessonOpenedState,
  getTextbookLessonData,
  recordLessonOpened
} from "@/lib/textbook";

type LessonReaderRouteProps = {
  params: Promise<{
    lessonSlug: string;
    mediaSlug: string;
  }>;
};

export default async function LessonReaderRoute({
  params
}: LessonReaderRouteProps) {
  const { lessonSlug, mediaSlug } = await params;
  const data = await getTextbookLessonData(mediaSlug, lessonSlug);

  if (!data) {
    notFound();
  }

  // Fire-and-forget: recording the open doesn't need to block rendering.
  // applyLessonOpenedState only patches the status label, which the client
  // can already derive — the write itself is the important side-effect.
  const openedState = recordLessonOpened(data.lesson.id);

  // Use Promise.allSettled so Next.js keeps the pending write alive after
  // the response streams, but we still apply the state optimistically when
  // the write finishes fast enough (which it almost always does for local
  // SQLite).  If it hasn't settled yet we just use the data as-is.
  const settled = await Promise.race([
    openedState.then((s) => s),
    // 0ms timeout: yield once so a resolved promise is picked up, but never
    // actually delay the response.
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 0))
  ]);

  return (
    <LessonReaderClient
      data={settled ? applyLessonOpenedState(data, settled) : data}
    />
  );
}
