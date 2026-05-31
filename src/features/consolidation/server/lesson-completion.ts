import { db, type DatabaseClient } from "@/db";
import { setLessonCompletionState } from "@/features/textbook/server/progress";

import { enqueueLessonConsolidation } from "./enqueue";

type SetLessonCompletionWithConsolidationInput = {
  completed: boolean;
  database?: DatabaseClient;
  lessonId: string;
  now?: Date;
};

export async function setLessonCompletionWithConsolidation(
  input: SetLessonCompletionWithConsolidationInput
) {
  const database = input.database ?? db;

  return database.transaction(async (transaction) => {
    const completion = await setLessonCompletionState(
      input.lessonId,
      input.completed,
      transaction
    );
    const consolidation =
      input.completed && completion.completedNow
        ? await enqueueLessonConsolidation({
            database: transaction,
            lessonId: input.lessonId,
            now: input.now
          })
        : {
            createdCount: 0,
            subjectKeys: [] as string[]
          };

    return {
      ...completion,
      consolidation
    };
  });
}
