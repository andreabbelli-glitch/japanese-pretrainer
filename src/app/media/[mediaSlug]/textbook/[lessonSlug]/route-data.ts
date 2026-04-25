import {
  getTextbookLessonData,
  recordLessonOpened,
  settleLessonOpenedStateForRender
} from "@/features/textbook/server";

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

  const openedState = recordLessonOpened(data.lesson.id);

  return settleLessonOpenedStateForRender(data, openedState);
}
