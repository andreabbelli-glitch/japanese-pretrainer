# Task 13 - Regression Fixes From Audit

## Tipo

Bugfix / audit follow-up

## Obiettivo

Correggere le regressioni introdotte dalle modifiche recenti in parser,
importer, textbook reader, glossary e review, riallineando il comportamento
runtime con la specifica contenuti e con i test del progetto.

## Input

- audit regressioni del 2026-03-10
- `04`
- `05`
- `07`
- `08`
- `09`
- `11`
- `12`

## Scope

- ripristinare il supporto ai riferimenti semantici dentro `inlineCode`, sia in
  fase di parsing sia in fase di raccolta link/import;
- correggere il rendering delle note markdown-like in glossary, review e
  textbook, evitando rendering lossy o incoerente con la sintassi supportata
  dal parser;
- preservare il nuovo campo `reading` delle grammar nel round-trip AST JSON del
  textbook reader;
- aggiornare o estendere i test per coprire i casi regressi;
- chiarire il perimetro del lint, evitando che vengano analizzati artefatti
  generati o worktree annidati non pertinenti al sorgente.

## Fuori scope

- redesign UI generale;
- nuove feature oltre ai fix emersi dall'audit;
- refactor ampio del parser non necessario per risolvere i bug target.

## Deliverable

- fix applicativi per parser, importer e UI runtime;
- test verdi sui casi regressi;
- eventuale esclusione lint per `.next`, `.claude/worktrees` o altri output
  generati, se necessaria;
- breve nota finale su root cause e verifiche eseguite.

## Dipendenze

- `04`
- `05`
- `07`
- `08`
- `09`
- `11`
- `12`

## Problemi da risolvere

### 1. Semantic links persi dentro inline code

Oggi un input come `` `[食べる](term:term-taberu)` `` viene trattato come puro
testo dentro `inlineCode`, quindi:

- il parser non registra riferimenti;
- l'importer non genera `entryLink` attesi;
- i tooltip/collegamenti derivati possono sparire senza errori espliciti.

Il comportamento corretto deve essere coerente con la documentazione contenuti,
che dichiara supporto a furigana e term/grammar links anche dentro i backtick.

### 2. Rendering note troppo semplificato e lossy

Le note `notesIt` ora arrivano grezze alla UI e vengono renderizzate con un
helper regex custom. Questo approccio oggi:

- non rende correttamente enfasi markdown come `**testo**`;
- non interpreta correttamente furigana o riferimenti quando sono dentro
  `inlineCode`;
- rischia divergenza tra sintassi supportata dal parser e sintassi resa a
  schermo.

Serve un approccio che mantenga fedelta semantica senza esporre markdown grezzo
all'utente.

### 3. Grammar reading perso nel textbook AST reload

Il campo `reading` e stato aggiunto alle grammar ma viene perso quando il
textbook reader ricarica AST JSON persistiti. Il round-trip deve conservare il
campo per non degradare i dati usati dalle view.

### 4. Lint rumoroso su artefatti generati

`pnpm lint` oggi entra anche in `.claude/worktrees/kind-banach/.next` e produce
migliaia di errori/warning su file buildati o esterni al perimetro sorgente.
Questo va separato dai fix applicativi: l'obiettivo e rendere il lint utile sui
file del progetto.

## File probabili da toccare

- `src/lib/content/parser/markdown.ts`
- `src/lib/content/importer/render.ts`
- `src/lib/content/importer/planner.ts`
- `src/lib/textbook-document.ts`
- `src/lib/render-furigana.tsx` oppure un sostituto piu robusto
- `src/lib/glossary.ts`
- `src/lib/review.ts`
- `src/components/glossary/glossary-detail-page.tsx`
- `src/components/review/review-page.tsx`
- `src/components/review/review-card-detail-page.tsx`
- `src/components/textbook/lesson-reader-client.tsx`
- `tests/content.test.ts`
- `tests/importer.test.ts`
- `tests/textbook.test.ts`
- `tests/glossary.test.ts`
- configurazione lint se necessaria

## Criteri di accettazione

- un riferimento semantico dentro backtick viene ancora tracciato come
  reference valida e genera i link/import attesi;
- note con furigana, semantic links e inline code non mostrano sintassi grezza
  all'utente nelle view glossary/review/textbook;
- il renderer delle note non perde supporto a casi gia validi nel parser;
- `reading` delle grammar sopravvive al parse di AST JSON persistiti;
- i test mirati su parser/importer/textbook/glossary/review passano;
- il lint non fallisce per colpa di output generati o worktree annidati.

## Verifiche minime richieste

- `pnpm test -- --runInBand tests/content.test.ts tests/importer.test.ts tests/textbook.test.ts tests/glossary.test.ts tests/review.test.ts`
- `pnpm typecheck`
- `pnpm lint`

## Note implementative

- Prima di modificare il codice, riprodurre localmente almeno questi due casi:
  - `parseInlineFragment('`[食べる](term:term-taberu)`')` deve produrre un
    reference.
  - `parseTextbookDocument(...)` su una `grammarDefinition` con `reading` deve
    preservare il campo.
- Evitare fix solo cosmetici nei test: il comportamento runtime va corretto,
  non soltanto riallineato alle aspettative correnti.
- Se l'helper regex per il rendering non basta, preferire un riuso del modello
  AST inline gia esistente invece di aggiungere nuove eccezioni ad hoc.
- Se si restringe il lint, farlo in modo esplicito e documentabile, senza
  escludere accidentalmente il vero codice sorgente.
