import { notFound } from "next/navigation";

import { LessonReaderClient } from "@/components/textbook/lesson-reader-client";
import { getTextbookLessonData, recordLessonOpened } from "@/lib/textbook";

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
  const initialData = await getTextbookLessonData(mediaSlug, lessonSlug);

  if (!initialData) {
    notFound();
  }

  await recordLessonOpened(initialData.lesson.id);

  const data = await getTextbookLessonData(mediaSlug, lessonSlug);

  if (!data) {
    notFound();
  }

  return <LessonReaderClient data={data} />;
}
