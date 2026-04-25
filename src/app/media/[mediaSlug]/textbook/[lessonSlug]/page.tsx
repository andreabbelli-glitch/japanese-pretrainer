import { notFound } from "next/navigation";

import { LessonReaderClient } from "@/components/textbook/lesson-reader-client";
import { loadLessonReaderRouteData } from "./route-data";

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
  const data = await loadLessonReaderRouteData({ lessonSlug, mediaSlug });

  if (!data) {
    notFound();
  }

  return <LessonReaderClient data={data} />;
}
