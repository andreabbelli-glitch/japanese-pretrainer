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

export type KatakanaSpeedModeGroupCopy = {
  readonly label: string;
  readonly options: readonly KatakanaSpeedModeCopy[];
};

export const KATAKANA_SPEED_MODE_GROUPS: readonly KatakanaSpeedModeGroupCopy[] =
  [
    {
      label: "Misura",
      options: [
        {
          detail: "mappa iniziale",
          label: "Diagnosi",
          mode: "diagnostic_probe"
        },
        {
          detail: "kana poco comuni",
          label: "Rare",
          mode: "rare_combo"
        },
        {
          detail: "25 celle a voce",
          label: "Griglia",
          mode: "ran_grid"
        }
      ]
    },
    {
      label: "Leggi",
      options: [
        {
          detail: "parole inventate",
          label: "Pseudo",
          mode: "pseudoword_transfer"
        },
        {
          detail: "decodifica prestiti",
          label: "Prestiti",
          mode: "loanword_decoder"
        },
        {
          detail: "frasi cronometrate",
          label: "Frasi",
          mode: "sentence_sprint"
        },
        {
          detail: "3 letture",
          label: "Ripetuta",
          mode: "repeated_reading"
        }
      ]
    },
    {
      label: "Ripara",
      options: [
        {
          detail: "ー, ッ, piccoli kana",
          label: "Trappole",
          mode: "mora_trap"
        },
        {
          detail: "trova il pezzo",
          label: "Chunk",
          mode: "chunk_spotting"
        },
        {
          detail: "ordina tessere",
          label: "Costruisci",
          mode: "tile_builder"
        },
        {
          detail: "confusioni verticali",
          label: "Scala",
          mode: "confusion_ladder"
        },
        {
          detail: "grafie alternative",
          label: "Varianti",
          mode: "variant_normalization"
        }
      ]
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
  const chunk =
    typeof trial.features?.chunk === "string" ? trial.features.chunk : null;

  if (trial.mode === "ran_grid") {
    return {
      controls:
        "Il timer parte da solo. Enter ferma o salva. Space mostra la lettura.",
      instruction:
        "Leggi tutte le celle da sinistra a destra, riga per riga. Ferma il timer, segna le celle sbagliate e salva.",
      label: "Griglia di velocita"
    };
  }

  if (trial.mode === "repeated_reading_pass") {
    return {
      controls:
        "Il timer parte da solo. Enter ferma o continua. Space mostra la lettura.",
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
      controls: "Space mostra o nasconde la lettura. Scegli 1-3 per valutarti.",
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

  if (interaction === "tile_builder") {
    return {
      controls:
        "Tocca le tessere in ordine. Space mostra la lettura. Usa Svuota se sbagli.",
      instruction:
        "Ricostruisci la parola toccando i chunk nell'ordine giusto, poi controlla.",
      label: "Ricostruisci la parola"
    };
  }

  if (interaction === "segment_select") {
    return {
      controls:
        "Tocca il chunk richiesto dentro la parola. Space mostra la lettura.",
      instruction: chunk
        ? `Trova il chunk ${chunk} nella parola.`
        : "Trova il chunk richiesto dentro la parola.",
      label: "Trova il chunk"
    };
  }

  if (exerciseCode === "E05") {
    return {
      controls:
        "Scegli se le due forme hanno la stessa lettura. Space mostra la lettura.",
      instruction: "Le due forme sono uguali o diverse nella lettura?",
      label: "Confronta due forme"
    };
  }

  if (exerciseCode === "E14") {
    return {
      controls:
        "Tocca la riga con il target mostrato nel prompt. Space mostra la lettura.",
      instruction: "Trova il target nella scala di confusioni.",
      label: "Scala di confusioni"
    };
  }

  if (exerciseCode === "E15" || exerciseCode === "E16") {
    return {
      controls:
        "Scegli la forma corretta tra le due opzioni. Space mostra la lettura.",
      instruction:
        "Scegli la forma corretta senza farti ingannare da ー, ッ o piccoli kana.",
      label: "Trappola di mora"
    };
  }

  if (exerciseCode === "E17") {
    return {
      controls:
        "Decidi se sono varianti accettabili della stessa parola. Space mostra la lettura.",
      instruction:
        "Le due grafie rappresentano la stessa variante o una forma diversa?",
      label: "Varianti di scrittura"
    };
  }

  if (trial.mode === "blink") {
    return {
      controls:
        "Rispondi con 1-2 dalla tastiera o tocca una scelta. Space mostra la lettura.",
      instruction: "Scegli rapidamente la scrittura corretta.",
      label: "Riconoscimento rapido"
    };
  }

  return {
    controls:
      "Rispondi con 1-4 dalla tastiera o tocca una scelta. Space mostra la lettura.",
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
