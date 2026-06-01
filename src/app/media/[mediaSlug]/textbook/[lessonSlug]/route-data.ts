import { getTextbookLessonData } from "@/features/textbook/server";

type LessonReaderRouteDataInput = {
  lessonSlug: string;
  mediaSlug: string;
};

export async function loadLessonReaderRouteData({
  lessonSlug,
  mediaSlug
}: LessonReaderRouteDataInput) {
  const data = await getTextbookLessonData(mediaSlug, lessonSlug);

  if (!data) {
    return null;
  }

  return data;
}
