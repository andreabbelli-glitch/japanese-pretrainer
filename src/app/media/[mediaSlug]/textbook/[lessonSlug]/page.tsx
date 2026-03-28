import { notFound } from "next/navigation";

import { LessonReaderClient } from "@/components/textbook/lesson-reader-client";
import {
  getTextbookLessonData,
  recordLessonOpened,
  settleLessonOpenedStateForRender
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

  const openedState = recordLessonOpened(data.lesson.id);
  const renderData = await settleLessonOpenedStateForRender(data, openedState);

  return <LessonReaderClient data={renderData} />;
}
