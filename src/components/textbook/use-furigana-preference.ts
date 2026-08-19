"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { setFuriganaModeAction } from "@/actions/textbook";
import type {
  FuriganaMode,
  TextbookLessonData
} from "@/features/textbook/types";

export function useFuriganaPreference(data: TextbookLessonData) {
  const [furiganaMode, setFuriganaModeState] = useState<FuriganaMode>(
    data.furiganaMode
  );
  const [isSavingFurigana, setIsSavingFurigana] = useState(false);
  const [serverSnapshot, setServerSnapshot] = useState(() => ({
    lessonId: data.lesson.id,
    mode: data.furiganaMode
  }));
  const currentLessonIdRef = useRef(data.lesson.id);
  const persistedFuriganaModeRef = useRef(data.furiganaMode);
  const queuedFuriganaModeRef = useRef<FuriganaMode | null>(null);

  if (
    serverSnapshot.lessonId !== data.lesson.id ||
    serverSnapshot.mode !== data.furiganaMode
  ) {
    const lessonChanged = serverSnapshot.lessonId !== data.lesson.id;

    setServerSnapshot({
      lessonId: data.lesson.id,
      mode: data.furiganaMode
    });
    setFuriganaModeState(data.furiganaMode);

    if (lessonChanged) {
      setIsSavingFurigana(false);
    }
  }

  useEffect(() => {
    const lessonChanged = currentLessonIdRef.current !== data.lesson.id;

    currentLessonIdRef.current = data.lesson.id;
    persistedFuriganaModeRef.current = data.furiganaMode;

    if (lessonChanged) {
      queuedFuriganaModeRef.current = null;
    }
  }, [data.furiganaMode, data.lesson.id]);

  const flushFuriganaModeChange = useCallback(
    async (nextMode: FuriganaMode) => {
      let targetMode = nextMode;

      setIsSavingFurigana(true);

      while (true) {
        try {
          await setFuriganaModeAction({
            mediaSlug: data.media.slug,
            lessonSlug: data.lesson.slug,
            mode: targetMode
          });
          persistedFuriganaModeRef.current = targetMode;
        } catch {
          queuedFuriganaModeRef.current = null;
          setFuriganaModeState(persistedFuriganaModeRef.current);
          setIsSavingFurigana(false);
          return;
        }

        const queuedMode = queuedFuriganaModeRef.current;

        if (!queuedMode || queuedMode === targetMode) {
          queuedFuriganaModeRef.current = null;
          setIsSavingFurigana(false);
          return;
        }

        targetMode = queuedMode;
      }
    },
    [data.lesson.slug, data.media.slug]
  );

  const handleFuriganaModeChange = useCallback(
    (nextMode: FuriganaMode) => {
      if (nextMode === furiganaMode) {
        return;
      }

      setFuriganaModeState(nextMode);

      if (isSavingFurigana) {
        queuedFuriganaModeRef.current = nextMode;
        return;
      }

      void flushFuriganaModeChange(nextMode);
    },
    [flushFuriganaModeChange, furiganaMode, isSavingFurigana]
  );

  return {
    furiganaMode,
    handleFuriganaModeChange,
    isSavingFurigana
  };
}
