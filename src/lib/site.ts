export type NavItem = {
  href: "/" | "/media" | "/review" | "/settings";
  label: string;
  description: string;
};

export type MediaCard = {
  title: string;
  type: string;
  status: string;
  nextStep: string;
  note: string;
};

export type ProgressTrack = {
  label: string;
  value: string;
  progress: number;
  note: string;
};

export type PlaceholderSection = {
  title: string;
  body: string;
};

export const primaryNav: NavItem[] = [
  {
    href: "/",
    label: "Home",
    description: "Oggi sul tavolo"
  },
  {
    href: "/media",
    label: "Media",
    description: "Pacchetti di studio"
  },
  {
    href: "/review",
    label: "Review",
    description: "Sessioni quotidiane"
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Preferenze locali"
  }
];

export const todaySession = {
  title: "Frieren",
  lesson: 'Riprendi dal paragrafo "Termini chiave"',
  summary:
    "Una scrivania di studio locale-first per tornare subito al punto in cui hai lasciato textbook, glossary e review.",
  metrics: ["42% textbook", "67 entry viste", "12 card dovute oggi"],
  review: {
    due: "18 dovute",
    fresh: "7 nuove",
    estimate: "~12 min"
  }
};

export const activeMedia: MediaCard[] = [
  {
    title: "Frieren",
    type: "anime",
    status: "attivo",
    nextStep: "Episodio 1 · Introduzione",
    note: "Lessico fantasy e pattern ricorrenti."
  },
  {
    title: "Pokemon TCG",
    type: "tcg",
    status: "in pausa",
    nextStep: "Deck basics · Energy curve",
    note: "Vocabolario tecnico e formule di matchup."
  },
  {
    title: "Persona 5",
    type: "videogioco",
    status: "bozza",
    nextStep: "Apri il primo capitolo",
    note: "Segmentazione pronta per route e aree."
  }
];

export const progressTracks: ProgressTrack[] = [
  {
    label: "Textbook",
    value: "42%",
    progress: 42,
    note: "lettura progressiva per lesson e segmenti"
  },
  {
    label: "Glossary",
    value: "67 / 140",
    progress: 48,
    note: "copertura entry distinta dalla review"
  },
  {
    label: "Review",
    value: "128 mature · 12 due",
    progress: 73,
    note: "ritmo calmo, niente gamification rumorosa"
  }
];

export const foundationNotes: PlaceholderSection[] = [
  {
    title: "Struttura pronta",
    body: "App Router, cartelle principali, test runner e layer di stile sono preparati per i task successivi senza introdurre logica di dominio."
  },
  {
    title: "Design tokens integrati",
    body: "La palette calda, la tipografia editoriale e le superfici morbide sono già disponibili in `src/styles` per reader, glossary e review."
  },
  {
    title: "Setup affidabile",
    body: "Lint, format, typecheck e test girano come comandi separati per supportare un flusso di lavoro semplice anche per agenti futuri."
  }
];

export const routePlaceholders = {
  media: {
    kicker: "Pacchetti di studio",
    title: "Catalogo media pronto per la shell applicativa",
    summary:
      "Questa rotta resta volutamente leggera: ospiterà la libreria dei media e i relativi entry point operativi nel Task 06.",
    sections: [
      {
        title: "Routing coerente",
        body: "La base include già una destinazione stabile per il catalogo, evitando di riorganizzare la navigazione più avanti."
      },
      {
        title: "Card editoriali",
        body: "Il layout supporta card larghe e descrittive invece di tab compressi o pannelli da backoffice."
      }
    ]
  },
  review: {
    kicker: "Sessioni quotidiane",
    title: "Review stage riservato alla prossima wave",
    summary:
      "Il flusso Anki-like arriverà più avanti. Per ora la rotta esiste, la shell la rende raggiungibile e il tono visivo è già allineato.",
    sections: [
      {
        title: "Area dedicata",
        body: "La sessione review avrà una larghezza massima indipendente e un ritmo visivo più serrato, separato dal reader."
      },
      {
        title: "Nessun fake flow",
        body: "In questa fase non simuliamo carte o grading: la fondazione resta pulita e non introduce comportamenti fittizi."
      }
    ]
  },
  settings: {
    kicker: "Preferenze locali",
    title: "Impostazioni predisposte senza over-engineering",
    summary:
      "Qui confluiranno preferenze come furigana, controlli di studio e comportamento locale dell'app, ma senza schema dati prematuro.",
    sections: [
      {
        title: "Locale-first",
        body: "Le configurazioni future sono pensate per un uso privato e locale, coerente con SQLite e con la natura single-user del progetto."
      },
      {
        title: "Task successivi",
        body: "Il percorso evita workaround temporanei: persistence e user settings verranno modellati davvero solo quando sarà il momento."
      }
    ]
  }
} as const;
