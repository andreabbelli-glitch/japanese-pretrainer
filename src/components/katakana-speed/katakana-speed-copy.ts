import type {
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

export type KatakanaSpeedTrialCopy = {
  readonly controls: string;
  readonly instruction: string;
  readonly label: string;
};

export function getKatakanaSpeedTrialCopy(
  trial: KatakanaSpeedTrialPlan,
  repeatedPassLabel?: string | null
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
        "Il timer parte da solo. Enter ferma o salva. La lettura compare dopo lo stop.",
      instruction:
        "Leggi tutte le celle da sinistra a destra, riga per riga. Ferma il timer, segna le celle sbagliate e salva.",
      label: "Griglia di velocita"
    };
  }

  if (trial.mode === "repeated_reading_pass") {
    return {
      controls:
        "Il timer parte da solo. Enter ferma o continua. La lettura compare dopo lo stop.",
      instruction:
        repeatedPassLabel === "Transfer"
          ? "Leggi la nuova frase con lo stesso pattern, ferma il timer e salva il blocco."
          : "Leggi il passaggio, ferma il timer e passa alla lettura successiva.",
      label: repeatedPassLabel
        ? `Lettura ripetuta: ${repeatedPassLabel}`
        : "Lettura ripetuta"
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
        "Leggi senza romaji. Scegli 1-3 per valutarti; la lettura compare dopo.",
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
        "Scegli la forma corretta tra le due opzioni. La lettura compare dopo.",
      instruction:
        "Scegli la forma che scrive la lettura mostrata, senza farti ingannare da ー, ッ o piccoli kana.",
      label: "Trappola di mora"
    };
  }

  if (trial.mode === "blink") {
    return {
      controls:
        "Rispondi con 1-2 dalla tastiera o tocca una scelta. La lettura compare dopo.",
      instruction: "Scegli rapidamente la scrittura corretta.",
      label: "Riconoscimento rapido"
    };
  }

  return {
    controls:
      "Rispondi con 1-4 dalla tastiera o tocca una scelta. La lettura compare dopo.",
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
