import type {
  KatakanaSpeedManualExercise,
  KatakanaSpeedSelfRating,
  KatakanaSpeedSessionMode,
  KatakanaSpeedTrialPlan
} from "@/features/katakana-speed/types";

export type KatakanaSpeedModeCopy = {
  readonly detail: string;
  readonly label: string;
  readonly mode: KatakanaSpeedSessionMode;
};

export const KATAKANA_SPEED_PRIMARY_ACTIONS: readonly KatakanaSpeedModeCopy[] =
  [
    {
      detail: "contrasti, lettura e transfer",
      label: "Start 5 min",
      mode: "daily"
    },
    {
      detail: "baseline breve",
      label: "Diagnosi",
      mode: "diagnostic_probe"
    },
    {
      detail: "focus sulla debolezza",
      label: "Ripara debolezza",
      mode: "repair"
    }
  ];

export type KatakanaSpeedManualExerciseCopy = {
  readonly count: number;
  readonly detail: string;
  readonly label: string;
  readonly manualExercise: KatakanaSpeedManualExercise;
};

export const KATAKANA_SPEED_MANUAL_EXERCISE_ACTIONS: readonly KatakanaSpeedManualExerciseCopy[] =
  [
    {
      count: 12,
      detail: "prompt romaji, quattro grafie vicine",
      label: "Romaji -> katakana",
      manualExercise: "romaji_to_katakana"
    },
    {
      count: 16,
      detail: "scelte rapide sul focus attuale",
      label: "Contrasti",
      manualExercise: "contrast"
    },
    {
      count: 16,
      detail: "parole e pseudo senza aiuti",
      label: "Lettura",
      manualExercise: "reading"
    },
    {
      count: 1,
      detail: "griglia 5x5 a timer",
      label: "Griglia RAN",
      manualExercise: "ran_grid"
    },
    {
      count: 16,
      detail: "coppie con ー e ッ",
      label: "Trappole ー/ッ",
      manualExercise: "mora_contrast"
    }
  ];

export type KatakanaSpeedTrialCopy = {
  readonly controls: string;
  readonly instruction: string;
  readonly label: string;
};

export function getKatakanaSpeedTrialCopy(
  trial: KatakanaSpeedTrialPlan
): KatakanaSpeedTrialCopy {
  const exerciseCode =
    typeof trial.features?.exerciseCode === "string"
      ? trial.features.exerciseCode
      : null;
  const interaction =
    typeof trial.features?.interaction === "string"
      ? trial.features.interaction
      : null;
  if (trial.mode === "ran_grid") {
    return {
      controls:
        "Il timer parte da solo. Space mostra/nasconde la lettura; clic segna un errore; Enter ferma o salva.",
      instruction:
        "Leggi i kana da sinistra a destra, riga per riga. Se sbagli una cella, cliccala subito; alla fine ferma il timer e salva.",
      label: "Griglia di velocita"
    };
  }

  if (
    trial.mode === "word_naming" ||
    trial.mode === "pseudoword_sprint" ||
    trial.mode === "sentence_sprint" ||
    interaction === "self_check"
  ) {
    return {
      controls:
        "Leggi senza romaji. Space mostra/nasconde la lettura; scegli 1-3 per valutarti.",
      instruction:
        trial.mode === "sentence_sprint"
          ? "Leggi la frase una volta, poi valuta se e stata fluida."
          : "Leggi ad alta voce o mentalmente, poi valuta com'e andata.",
      label:
        trial.mode === "pseudoword_sprint"
          ? "Leggi senza memoria"
          : trial.mode === "sentence_sprint"
            ? "Leggi la frase"
            : "Leggi la parola"
    };
  }

  if (exerciseCode === "E15" || exerciseCode === "E16") {
    return {
      controls:
        "Scegli la forma corretta tra le due opzioni. Space mostra/nasconde la lettura.",
      instruction:
        "Scegli la forma che scrive la lettura mostrata, senza farti ingannare da ー, ッ o piccoli kana.",
      label: "Trappola di mora"
    };
  }

  if (
    trial.features?.exerciseFamily === "romaji_to_katakana_choice" ||
    trial.features?.promptKind === "romaji"
  ) {
    return {
      controls: "Rispondi con 1-4 dalla tastiera o tocca una scelta.",
      instruction:
        "Leggi il romaji e scegli la scrittura katakana corretta tra opzioni molto simili.",
      label: "Dal romaji al kana"
    };
  }

  if (trial.mode === "blink") {
    return {
      controls:
        "Rispondi con 1-2 dalla tastiera o tocca una scelta. Space mostra/nasconde la lettura.",
      instruction: "Scegli rapidamente la scrittura corretta.",
      label: "Riconoscimento rapido"
    };
  }

  return {
    controls:
      "Rispondi con 1-4 dalla tastiera o tocca una scelta. Space mostra/nasconde la lettura.",
    instruction: "Guarda il prompt e scegli la risposta corretta.",
    label: "Scegli la lettura"
  };
}

export function formatKatakanaSpeedTarget(value: number) {
  return `≤ ${(value / 1000).toFixed(1).replace(".", ",")} s`;
}

export function formatSelfRatingLabel(value: KatakanaSpeedSelfRating) {
  if (value === "clean") {
    return "Fluida";
  }
  if (value === "hesitated") {
    return "Incerta";
  }

  return "Da rifare";
}
