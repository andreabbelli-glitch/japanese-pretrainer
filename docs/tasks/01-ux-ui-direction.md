# Task 01 - UX/UI Direction

## Tipo

Design system + UX strategy

## Obiettivo

Definire una direzione UX/UI coerente, semplice da usare e piacevole da vedere,
evitando una UI da admin panel generico.

## Contesto

L'app e uno strumento di studio personale. Deve sembrare un ambiente di studio,
non un cruscotto enterprise. La leggibilita del giapponese e prioritaria, ma
senza sacrificare il carattere visivo.

## Direzione visiva richiesta

- mood: studio desk editoriale, caldo, calmo, concentrato;
- evitare look viola/neon o dashboard fredda;
- usare una palette con sfondo carta, inchiostro scuro, accenti verdi o
  vermiglio per stati rilevanti;
- usare una gerarchia tipografica forte ma sobria;
- il giapponese deve restare piu leggibile del testo italiano, non il contrario.

## Vincoli UX

- mobile e desktop entrambi first-class;
- furigana sempre controllabili;
- tooltip mai invasivi;
- le azioni di studio devono essere chiare in un colpo d'occhio;
- la navigazione deve ridurre il carico cognitivo.

## Deliverable

- direction doc sintetico con palette, tipografia e principi di layout;
- set iniziale di design tokens CSS;
- wireframe low-fi per:
  - dashboard;
  - media page;
  - textbook reader;
  - glossary;
  - review session;
- regole responsive per tooltip, drawer, nav e azioni primarie.

## Scelte consigliate

- heading latin: font editoriale con carattere, es. `Fraunces` o `Newsreader`;
- body UI: font leggibile, non default stack;
- testo giapponese: font dedicato leggibile, es. `BIZ UDPGothic` o `Noto Sans JP`;
- motion: transizioni brevi e intenzionali, non micro-animazioni casuali;
- componenti chiave: sticky study header, lesson rail, mobile bottom sheet.

## Criteri di accettazione

- la direzione visiva e abbastanza specifica da guidare gli implementatori;
- esistono token per colori, spaziature, radius, ombre e tipografia;
- i flussi principali hanno wireframe desktop e mobile;
- il reader e il review flow risultano leggibili anche con molto testo giapponese;
- la UI evita pattern impersonali da template.

## Fuori scope

- UI finale pixel-perfect;
- animazioni avanzate;
- branding definitivo.
